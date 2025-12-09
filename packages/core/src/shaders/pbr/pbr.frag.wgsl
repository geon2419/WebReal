struct Uniforms {
  mvpMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,
  baseColor: vec4f,          // rgb + alpha
  pbrParams: vec4f,          // x = metalness, y = roughness, z = aoIntensity, w = normalScale
  emissive: vec4f,           // rgb + intensity
  envParams: vec4f,          // x = envMapIntensity, y = lightCount, z = hasEnvMap, w = unused
  cameraPosition: vec4f,
  ambientLight: vec4f,       // rgb + intensity
  // lights[4]: each light is 3 vec4f (48 bytes)
  light0Position: vec4f,
  light0Color: vec4f,
  light0Params: vec4f,
  light1Position: vec4f,
  light1Color: vec4f,
  light1Params: vec4f,
  light2Position: vec4f,
  light2Color: vec4f,
  light2Params: vec4f,
  light3Position: vec4f,
  light3Color: vec4f,
  light3Params: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var albedoMap: texture_2d<f32>;
@group(0) @binding(3) var normalMap: texture_2d<f32>;
@group(0) @binding(4) var roughnessMap: texture_2d<f32>;
@group(0) @binding(5) var metalnessMap: texture_2d<f32>;
@group(0) @binding(6) var aoMap: texture_2d<f32>;
@group(0) @binding(7) var emissiveMap: texture_2d<f32>;
@group(0) @binding(8) var envMap: texture_2d<f32>;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) worldPosition: vec3f,
  @location(2) uv: vec2f,
  @location(3) worldTangent: vec3f,
  @location(4) worldBitangent: vec3f,
}

const PI: f32 = 3.14159265359;

// GGX/Trowbridge-Reitz Normal Distribution Function
fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let NdotH = max(dot(N, H), 0.0);
  let NdotH2 = NdotH * NdotH;
  
  let denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

// Schlick-GGX Geometry Function (single direction)
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith's Geometry Function (combined view and light directions)
fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
  let NdotV = max(dot(N, V), 0.0);
  let NdotL = max(dot(N, L), 0.0);
  let ggx1 = geometrySchlickGGX(NdotV, roughness);
  let ggx2 = geometrySchlickGGX(NdotL, roughness);
  return ggx1 * ggx2;
}

// Schlick Fresnel Approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Schlick Fresnel with roughness for IBL
fn fresnelSchlickRoughness(cosTheta: f32, F0: vec3f, roughness: f32) -> vec3f {
  return F0 + (max(vec3f(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Calculate attenuation for point lights
fn calculateAttenuation(distance: f32, range: f32, attenuationType: f32, param: f32) -> f32 {
  let normalizedDist = distance / range;
  
  if (attenuationType < 0.5) {
    // Linear: 1 - d/range
    return max(1.0 - normalizedDist, 0.0);
  } else if (attenuationType < 1.5) {
    // Quadratic: (1 - d/range)^2
    let linear = max(1.0 - normalizedDist, 0.0);
    return linear * linear;
  } else {
    // Physical: 1 / (1 + (d/range)^2 * k)
    return 1.0 / (1.0 + normalizedDist * normalizedDist * param);
  }
}

// Sample equirectangular environment map
fn sampleEquirectangular(direction: vec3f) -> vec2f {
  // Convert direction to spherical coordinates
  let phi = atan2(direction.z, direction.x);
  let theta = asin(clamp(direction.y, -1.0, 1.0));
  
  // Map to UV coordinates [0, 1]
  let u = (phi + PI) / (2.0 * PI);
  let v = (theta + PI * 0.5) / PI;
  
  return vec2f(u, 1.0 - v);
}

// Calculate light contribution for a single light
fn calculateLightContribution(
  lightPosition: vec4f,
  lightColor: vec4f,
  lightParams: vec4f,
  N: vec3f,
  V: vec3f,
  worldPos: vec3f,
  albedo: vec3f,
  metalness: f32,
  roughness: f32,
  F0: vec3f
) -> vec3f {
  let lightType = lightParams.x;
  let range = lightParams.y;
  let attenuationType = lightParams.z;
  let attenuationParam = lightParams.w;
  
  var L: vec3f;
  var attenuation: f32 = 1.0;
  
  if (lightType < 0.5) {
    // Directional light: use direction directly (negate for incoming)
    L = normalize(-lightPosition.xyz);
  } else {
    // Point light: calculate direction from position
    let lightVec = lightPosition.xyz - worldPos;
    let distance = length(lightVec);
    L = normalize(lightVec);
    attenuation = calculateAttenuation(distance, range, attenuationType, attenuationParam);
  }
  
  let H = normalize(V + L);
  let radiance = lightColor.rgb * lightColor.a * attenuation;
  
  // Cook-Torrance BRDF
  let NDF = distributionGGX(N, H, roughness);
  let G = geometrySmith(N, V, L, roughness);
  let F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  
  let numerator = NDF * G * F;
  let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
  let specular = numerator / denominator;
  
  // Energy conservation: diffuse = 1 - specular (metals have no diffuse)
  let kS = F;
  let kD = (vec3f(1.0) - kS) * (1.0 - metalness);
  
  let NdotL = max(dot(N, L), 0.0);
  
  return (kD * albedo / PI + specular) * radiance * NdotL;
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  // Construct TBN matrix
  let T = normalize(input.worldTangent);
  let B = normalize(input.worldBitangent);
  let N_geom = normalize(input.worldNormal);
  let TBN = mat3x3f(T, B, N_geom);
  
  // Sample normal map and apply normal scale
  let normalMapSample = textureSample(normalMap, textureSampler, input.uv).rgb;
  var normalTangent = normalMapSample * 2.0 - 1.0;
  let normalScale = uniforms.pbrParams.w;
  normalTangent = vec3f(normalTangent.x * normalScale, normalTangent.y * normalScale, normalTangent.z);
  normalTangent = normalize(normalTangent);
  let N = normalize(TBN * normalTangent);
  
  let V = normalize(uniforms.cameraPosition.xyz - input.worldPosition);
  
  // Sample material textures
  let albedoSample = textureSample(albedoMap, textureSampler, input.uv);
  let albedo = albedoSample.rgb * uniforms.baseColor.rgb;
  
  // Texture maps: when no map is provided, dummy white texture (1.0) is used
  // so uniform value * 1.0 = uniform value
  let roughnessSample = textureSample(roughnessMap, textureSampler, input.uv).g;
  let metalnessSample = textureSample(metalnessMap, textureSampler, input.uv).b;
  let aoSample = textureSample(aoMap, textureSampler, input.uv).r;
  let emissiveSample = textureSample(emissiveMap, textureSampler, input.uv).rgb;
  
  // Combine texture samples with uniform values
  let metalness = uniforms.pbrParams.x * metalnessSample;
  let roughness = max(uniforms.pbrParams.y * roughnessSample, 0.04); // Clamp to avoid division issues
  let ao = mix(1.0, aoSample, uniforms.pbrParams.z);
  
  // Calculate F0 (reflectance at normal incidence)
  // Dielectrics have F0 around 0.04, metals use albedo color
  let F0 = mix(vec3f(0.04), albedo, metalness);
  
  // Accumulate light contributions
  var Lo = vec3f(0.0);
  let lightCount = i32(uniforms.envParams.y);
  
  // Process each light (up to 4)
  if (lightCount > 0) {
    Lo += calculateLightContribution(
      uniforms.light0Position, uniforms.light0Color, uniforms.light0Params,
      N, V, input.worldPosition, albedo, metalness, roughness, F0
    );
  }
  if (lightCount > 1) {
    Lo += calculateLightContribution(
      uniforms.light1Position, uniforms.light1Color, uniforms.light1Params,
      N, V, input.worldPosition, albedo, metalness, roughness, F0
    );
  }
  if (lightCount > 2) {
    Lo += calculateLightContribution(
      uniforms.light2Position, uniforms.light2Color, uniforms.light2Params,
      N, V, input.worldPosition, albedo, metalness, roughness, F0
    );
  }
  if (lightCount > 3) {
    Lo += calculateLightContribution(
      uniforms.light3Position, uniforms.light3Color, uniforms.light3Params,
      N, V, input.worldPosition, albedo, metalness, roughness, F0
    );
  }
  
  // Ambient lighting (simple approximation)
  let ambientColor = uniforms.ambientLight.rgb * uniforms.ambientLight.a;
  var ambient = ambientColor * albedo * ao;
  
  // Environment map reflection (simple equirectangular sampling)
  let hasEnvMap = uniforms.envParams.z;
  if (hasEnvMap > 0.5) {
    let R = reflect(-V, N);
    let envUV = sampleEquirectangular(R);
    
    // Use roughness to select mip level (approximation)
    let maxMipLevel = 8.0;
    let mipLevel = roughness * maxMipLevel;
    let envColor = textureSampleLevel(envMap, textureSampler, envUV, mipLevel).rgb;
    
    // Fresnel for environment reflection
    let F_env = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    let kS_env = F_env;
    let kD_env = (1.0 - kS_env) * (1.0 - metalness);
    
    // Add environment contribution
    let envContribution = envColor * F_env * uniforms.envParams.x;
    ambient += envContribution * ao;
  }
  
  // Emissive contribution
  let emissiveColor = (uniforms.emissive.rgb + emissiveSample) * uniforms.emissive.a;
  
  // Final color
  var color = ambient + Lo + emissiveColor;
  
  // Simple Reinhard tone mapping
  color = color / (color + vec3f(1.0));
  
  // Gamma correction (linear to sRGB)
  color = pow(color, vec3f(1.0 / 2.2));
  
  return vec4f(color, albedoSample.a * uniforms.baseColor.a);
}
