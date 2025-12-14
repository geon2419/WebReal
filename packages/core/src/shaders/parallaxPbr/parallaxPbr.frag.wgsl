struct Uniforms {
  mvpMatrix: mat4x4f,         // 0-64: MVP matrix (renderer)
  modelMatrix: mat4x4f,       // 64-128: model matrix
  normalMatrix: mat4x4f,      // 128-192: normal matrix
  cameraPosition: vec4f,      // 192-208: camera position (xyz, w unused)
  pbrParams: vec4f,           // 208-224: metalness, roughness, aoIntensity, normalScale
  parallaxParams: vec4f,      // 224-240: depthScale, selfShadowStrength, flags, hasNormalMap
  envParams: vec4f,           // 240-256: envMapIntensity, lightCount, envMode, maxMipLevel
  ambientLight: vec4f,        // 256-272: rgb + intensity
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
@group(0) @binding(2) var albedoTexture: texture_2d<f32>;
@group(0) @binding(3) var depthTexture: texture_2d<f32>;
@group(0) @binding(4) var normalTexture: texture_2d<f32>;
@group(0) @binding(5) var roughnessMap: texture_2d<f32>;
@group(0) @binding(6) var metalnessMap: texture_2d<f32>;
@group(0) @binding(7) var aoMap: texture_2d<f32>;
@group(0) @binding(8) var emissiveMap: texture_2d<f32>;
@group(0) @binding(9) var envMap: texture_2d<f32>;

// IBL textures (mode 2) - optional
@group(1) @binding(0) var iblSampler: sampler;
@group(1) @binding(1) var prefilteredMap: texture_cube<f32>;
@group(1) @binding(2) var irradianceMap: texture_cube<f32>;
@group(1) @binding(3) var brdfLUT: texture_2d<f32>;

struct FragmentInput {
  @location(0) uv: vec2f,
  @location(1) worldPosition: vec3f,
  @location(2) worldNormal: vec3f,
  @location(3) worldTangent: vec3f,
  @location(4) worldBitangent: vec3f,
  @location(5) viewDir: vec3f,
}

const PI: f32 = 3.14159265359;

// Parallax flags
const PARALLAX_FLAG_INVERT_HEIGHT: u32 = 1u;
const PARALLAX_FLAG_GENERATE_NORMAL_FROM_DEPTH: u32 = 2u;
const PARALLAX_FLAG_SELF_SHADOW: u32 = 4u;

// Parallax tuning
const PARALLAX_DEPTH_EPS: f32 = 1e-6;
const PARALLAX_MIN_LAYERS: f32 = 8.0;
const PARALLAX_MAX_LAYERS: f32 = 64.0;
const PARALLAX_LAYERS_FROM_OFFSET_SCALE: f32 = 24.0;
const PARALLAX_MAX_OFFSET: f32 = 0.08;
const PARALLAX_VZ_MIN: f32 = 0.08;
const PARALLAX_ANGLE_FADE_START: f32 = 0.12;
const PARALLAX_ANGLE_FADE_END: f32 = 0.35;

// GGX/Trowbridge-Reitz Normal Distribution Function
// Calculates the microfacet distribution for specular reflections based on surface roughness
fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let NdotH = max(dot(N, H), 0.0);
  let NdotH2 = NdotH * NdotH;
  let denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

// Schlick-GGX Geometry Function (single direction)
// Computes self-shadowing and masking of microfacets for a single view or light direction
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith's Geometry Function
// Combines geometry shadowing/masking for both view and light directions
fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
  let NdotV = max(dot(N, V), 0.0);
  let NdotL = max(dot(N, L), 0.0);
  let ggx1 = geometrySchlickGGX(NdotV, roughness);
  let ggx2 = geometrySchlickGGX(NdotL, roughness);
  return ggx1 * ggx2;
}

// Schlick Fresnel Approximation
// Approximates the Fresnel effect (reflectivity based on viewing angle)
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Schlick Fresnel with roughness for IBL
// Extended Fresnel approximation that accounts for surface roughness in image-based lighting
fn fresnelSchlickRoughness(cosTheta: f32, F0: vec3f, roughness: f32) -> vec3f {
  return F0 + (max(vec3f(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Calculates light intensity falloff based on distance and attenuation type
fn calculateAttenuation(distance: f32, range: f32, attenuationType: f32, param: f32) -> f32 {
  let normalizedDist = distance / range;
  if (attenuationType < 0.5) {
    return max(1.0 - normalizedDist, 0.0);
  } else if (attenuationType < 1.5) {
    let linear = max(1.0 - normalizedDist, 0.0);
    return linear * linear;
  } else {
    return 1.0 / (1.0 + normalizedDist * normalizedDist * param);
  }
}

// Converts a 3D direction vector to 2D UV coordinates for equirectangular environment map sampling
fn sampleEquirectangular(direction: vec3f) -> vec2f {
  let phi = atan2(direction.z, direction.x);
  let theta = asin(clamp(direction.y, -1.0, 1.0));
  let u = (phi + PI) / (2.0 * PI);
  let v = (theta + PI * 0.5) / PI;
  return vec2f(u, 1.0 - v);
}

// Computes the PBR lighting contribution from a single light source (directional or point)
// Returns the combined diffuse and specular lighting based on Cook-Torrance BRDF
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
    L = normalize(-lightPosition.xyz);
  } else {
    let lightVec = lightPosition.xyz - worldPos;
    let distance = length(lightVec);
    L = normalize(lightVec);
    attenuation = calculateAttenuation(distance, range, attenuationType, attenuationParam);
  }
  
  let H = normalize(V + L);
  let radiance = lightColor.rgb * lightColor.a * attenuation;
  
  let NDF = distributionGGX(N, H, roughness);
  let G = geometrySmith(N, V, L, roughness);
  let F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  
  let numerator = NDF * G * F;
  let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
  let specular = numerator / denominator;
  
  // Clamp specular to prevent overly bright highlights
  let specularClamped = min(specular, vec3f(1.0));
  
  let kS = F;
  let kD = (vec3f(1.0) - kS) * (1.0 - metalness);
  
  let NdotL = max(dot(N, L), 0.0);
  
  return (kD * albedo / PI + specularClamped) * radiance * NdotL;
}

// Calculates image-based lighting using prefiltered environment maps (PMREM)
// Returns diffuse irradiance and specular prefiltered environment reflection
fn calculateIBLContribution(
  N: vec3f,
  V: vec3f,
  albedo: vec3f,
  metalness: f32,
  roughness: f32,
  F0: vec3f,
  ao: f32,
  envMapIntensity: f32,
  maxMipLevel: f32
) -> vec3f {
  let NdotV = max(dot(N, V), 0.0);
  let R = reflect(-V, N);
  
  let irradiance = textureSample(irradianceMap, iblSampler, N).rgb;
  let mipLevel = roughness * maxMipLevel;
  let prefilteredColor = textureSampleLevel(prefilteredMap, iblSampler, R, mipLevel).rgb;
  let brdf = textureSample(brdfLUT, iblSampler, vec2f(NdotV, roughness)).rg;
  
  let F = fresnelSchlickRoughness(NdotV, F0, roughness);
  
  let kS = F;
  let kD = (1.0 - kS) * (1.0 - metalness);
  let diffuseIBL = kD * irradiance * albedo;
  let specularIBL = prefilteredColor * (F * brdf.x + brdf.y);
  
  return (diffuseIBL + specularIBL) * ao * envMapIntensity;
}

struct ParallaxParams {
  depthScale: f32,
  normalScale: f32,
  hasNormalMap: bool,
  flags: u32,
  selfShadowStrength: f32,
}

struct ParallaxResult {
  uv: vec2f,
  uvDx: vec2f,
  uvDy: vec2f,
}

// Extracts and packages parallax mapping parameters from uniforms
fn getParallaxParams() -> ParallaxParams {
  let flags = u32(clamp(round(uniforms.parallaxParams.z), 0.0, 255.0));
  return ParallaxParams(
    uniforms.parallaxParams.x,
    uniforms.pbrParams.w,
    uniforms.parallaxParams.w > 0.5,
    flags,
    uniforms.parallaxParams.y,
  );
}

// Samples the height/depth texture and optionally inverts the value based on flags
fn parallaxSampleHeight(uv: vec2f, flags: u32) -> f32 {
  let d = textureSampleLevel(depthTexture, textureSampler, uv, 0.0).r;
  if ((flags & PARALLAX_FLAG_INVERT_HEIGHT) != 0u) {
    return 1.0 - d;
  }
  return d;
}

// Returns a fade factor near texture edges to smoothly disable parallax at boundaries
fn parallaxEdgeFade(inputUV: vec2f) -> f32 {
  let edge = min(min(inputUV.x, 1.0 - inputUV.x), min(inputUV.y, 1.0 - inputUV.y));
  return smoothstep(0.0, 0.05, edge);
}

// Performs steep parallax occlusion mapping with binary refinement to offset UVs based on depth
// Uses adaptive layer count and angle-based fading for realistic surface depth appearance
fn parallaxMapping(uv: vec2f, viewDir: vec3f, TBN: mat3x3f, params: ParallaxParams) -> vec2f {
  let viewDirTangent = normalize(transpose(TBN) * viewDir);
  if (params.depthScale <= PARALLAX_DEPTH_EPS) {
    return uv;
  }

  let vzAbs = abs(viewDirTangent.z);
  let layersFromAngle = mix(PARALLAX_MAX_LAYERS, PARALLAX_MIN_LAYERS, vzAbs);
  let angleFade = smoothstep(PARALLAX_ANGLE_FADE_START, PARALLAX_ANGLE_FADE_END, vzAbs);
  let vz = max(vzAbs, PARALLAX_VZ_MIN);
  let baseP = (viewDirTangent.xy / vz) * params.depthScale;

  let layersFromOffset = clamp(PARALLAX_MIN_LAYERS + length(baseP) * PARALLAX_LAYERS_FROM_OFFSET_SCALE, PARALLAX_MIN_LAYERS, PARALLAX_MAX_LAYERS);
  let numLayers = clamp(max(layersFromAngle, layersFromOffset), PARALLAX_MIN_LAYERS, PARALLAX_MAX_LAYERS);
  let layerDepth = 1.0 / numLayers;

  var P = baseP;
  let pLen = length(P);
  if (pLen > PARALLAX_MAX_OFFSET) {
    P *= PARALLAX_MAX_OFFSET / pLen;
  }
  P *= angleFade;
  let deltaTexCoords = P / numLayers;

  var currentLayerDepth = 0.0;
  var currentTexCoords = uv;
  var currentDepthMapValue = parallaxSampleHeight(currentTexCoords, params.flags);

  for (var i = 0; i < 64; i = i + 1) {
    if (f32(i) >= numLayers) { break; }
    if (currentLayerDepth >= currentDepthMapValue) { break; }
    currentTexCoords -= deltaTexCoords;
    currentDepthMapValue = parallaxSampleHeight(currentTexCoords, params.flags);
    currentLayerDepth += layerDepth;
  }

  // Binary refinement
  let refineSteps = select(3, 4, numLayers > 28.0);
  var aUV = currentTexCoords + deltaTexCoords;
  var bUV = currentTexCoords;
  var aDepth = currentLayerDepth - layerDepth;
  var bDepth = currentLayerDepth;

  for (var j = 0; j < 4; j = j + 1) {
    if (j >= refineSteps) { break; }
    let midUV = (aUV + bUV) * 0.5;
    let midDepth = (aDepth + bDepth) * 0.5;
    let heightMid = parallaxSampleHeight(midUV, params.flags);
    if (midDepth < heightMid) {
      aUV = midUV;
      aDepth = midDepth;
    } else {
      bUV = midUV;
      bDepth = midDepth;
    }
  }

  let heightA = parallaxSampleHeight(aUV, params.flags);
  let heightB = parallaxSampleHeight(bUV, params.flags);
  let afterDepth = heightB - bDepth;
  let beforeDepth = heightA - aDepth;
  let denom = afterDepth - beforeDepth;
  let weightUnclamped = select(afterDepth / denom, 0.5, abs(denom) < 1e-5);
  let weight = clamp(weightUnclamped, 0.0, 1.0);
  return aUV * weight + bUV * (1.0 - weight);
}

// Computes parallax-adjusted UVs with edge fading and texture derivatives for gradient sampling
fn parallaxComputeResult(inputUV: vec2f, viewDir: vec3f, TBN: mat3x3f, params: ParallaxParams) -> ParallaxResult {
  let displacedUV = parallaxMapping(inputUV, viewDir, TBN, params);
  let fade = parallaxEdgeFade(inputUV);
  let displacedUVClamped = clamp(displacedUV, vec2f(0.0), vec2f(1.0));
  let parallaxUV = mix(inputUV, displacedUVClamped, fade);
  let uvDx = dpdx(parallaxUV);
  let uvDy = dpdy(parallaxUV);
  return ParallaxResult(parallaxUV, uvDx, uvDy);
}

// Generates a tangent-space normal map from depth texture using Sobel operator
// Useful when only a height/depth map is available without an explicit normal map
fn parallaxGenerateNormalFromDepth(uv: vec2f, texelSize: vec2f, params: ParallaxParams) -> vec3f {
  let invertHeight = (params.flags & PARALLAX_FLAG_INVERT_HEIGHT) != 0u;

  let d00Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(-texelSize.x, -texelSize.y), 0.0).r;
  let d10Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(0.0, -texelSize.y), 0.0).r;
  let d20Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(texelSize.x, -texelSize.y), 0.0).r;
  let d01Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(-texelSize.x, 0.0), 0.0).r;
  let d21Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(texelSize.x, 0.0), 0.0).r;
  let d02Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(-texelSize.x, texelSize.y), 0.0).r;
  let d12Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(0.0, texelSize.y), 0.0).r;
  let d22Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(texelSize.x, texelSize.y), 0.0).r;

  let d00 = select(d00Base, 1.0 - d00Base, invertHeight);
  let d10 = select(d10Base, 1.0 - d10Base, invertHeight);
  let d20 = select(d20Base, 1.0 - d20Base, invertHeight);
  let d01 = select(d01Base, 1.0 - d01Base, invertHeight);
  let d21 = select(d21Base, 1.0 - d21Base, invertHeight);
  let d02 = select(d02Base, 1.0 - d02Base, invertHeight);
  let d12 = select(d12Base, 1.0 - d12Base, invertHeight);
  let d22 = select(d22Base, 1.0 - d22Base, invertHeight);
  
  let dx = (d20 + 2.0 * d21 + d22) - (d00 + 2.0 * d01 + d02);
  let dy = (d02 + 2.0 * d12 + d22) - (d00 + 2.0 * d10 + d20);

  let slopeScale = params.depthScale * params.normalScale;
  return normalize(vec3f(-dx * slopeScale, -dy * slopeScale, 1.0));
}

// Constructs an orthonormal tangent-bitangent-normal (TBN) matrix for transforming normals
// Uses Gram-Schmidt orthogonalization and handles handedness correctly
fn buildTBN(worldNormal: vec3f, worldTangent: vec3f, worldBitangent: vec3f) -> mat3x3f {
  let N = normalize(worldNormal);
  let T0 = normalize(worldTangent);
  let T = normalize(T0 - N * dot(N, T0));
  let B0 = normalize(worldBitangent);
  let handedness = select(-1.0, 1.0, dot(cross(N, T), B0) >= 0.0);
  let B = normalize(cross(N, T) * handedness);
  return mat3x3f(T, B, N);
}

// Samples the albedo texture with parallax-adjusted UVs and converts from sRGB to linear space
fn surfaceSampleAlbedo(parallax: ParallaxResult) -> vec3f {
  let srgb = textureSampleGrad(albedoTexture, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).rgb;
  return srgbToLinear(srgb);  // Convert sRGB texture to linear space for PBR
}

// Applies self-shadowing/cavity occlusion based on depth and viewing angle
// Creates darker crevices and depth-based shading for more realistic surface detail
fn surfaceApplySelfShadow(albedoIn: vec3f, parallaxUV: vec2f, viewDir: vec3f, TBN: mat3x3f, params: ParallaxParams) -> vec3f {
  if ((params.flags & PARALLAX_FLAG_SELF_SHADOW) == 0u) {
    return albedoIn;
  }
  let strength = params.selfShadowStrength;
  let Vt = transpose(TBN) * viewDir;
  let grazing = 1.0 - clamp(abs(Vt.z), 0.0, 1.0);
  let height = parallaxSampleHeight(parallaxUV, params.flags);
  let cavity = clamp(1.0 - height, 0.0, 1.0);
  let occlusion = 1.0 - cavity * strength * (0.25 + 0.75 * grazing);
  return albedoIn * clamp(occlusion, 0.0, 1.0);
}

// Retrieves tangent-space normal from normal map, generates it from depth, or returns default
// Supports normal map scaling and procedural normal generation
fn surfaceGetNormalTangent(parallax: ParallaxResult, params: ParallaxParams) -> vec3f {
  if (params.hasNormalMap) {
    let normalMapSample = textureSampleGrad(normalTexture, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).rgb;
    var n = normalize(normalMapSample * 2.0 - 1.0);
    n = normalize(vec3f(n.x * params.normalScale, n.y * params.normalScale, n.z));
    return n;
  }

  if ((params.flags & PARALLAX_FLAG_GENERATE_NORMAL_FROM_DEPTH) != 0u) {
    let dims = vec2f(textureDimensions(depthTexture, 0));
    let texelSize = 1.0 / max(dims, vec2f(1.0));
    return parallaxGenerateNormalFromDepth(parallax.uv, texelSize, params);
  }

  return vec3f(0.0, 0.0, 1.0);
}

// Converts sRGB color values to linear color space using the correct gamma curve
// Required for physically accurate lighting calculations
fn srgbToLinear(color: vec3f) -> vec3f {
  // More accurate sRGB to linear conversion
  let cutoff = vec3f(0.04045);
  let linear_low = color / 12.92;
  let linear_high = pow((color + 0.055) / 1.055, vec3f(2.4));
  return select(linear_high, linear_low, color <= cutoff);
}

// Converts linear color values back to sRGB color space for display
// Applies the inverse gamma curve for correct monitor output
fn linearToSrgb(color: vec3f) -> vec3f {
  // More accurate linear to sRGB conversion
  let cutoff = vec3f(0.0031308);
  let srgb_low = color * 12.92;
  let srgb_high = 1.055 * pow(color, vec3f(1.0 / 2.4)) - 0.055;
  return select(srgb_high, srgb_low, color <= cutoff);
}

// Applies Reinhard tone mapping to compress HDR values into displayable range
fn toneMapReinhard(color: vec3f) -> vec3f {
  return color / (color + vec3f(1.0));
}

// Applies gamma correction by converting from linear to sRGB color space
fn gammaCorrect(color: vec3f) -> vec3f {
  return linearToSrgb(color);
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  let TBN = buildTBN(input.worldNormal, input.worldTangent, input.worldBitangent);
  let params = getParallaxParams();
  let parallax = parallaxComputeResult(input.uv, input.viewDir, TBN, params);
  let viewDir = normalize(input.viewDir);

  // Sample albedo with parallax UV
  var albedo = surfaceSampleAlbedo(parallax);
  albedo = surfaceApplySelfShadow(albedo, parallax.uv, viewDir, TBN, params);

  // Get normal
  let normalTangent = surfaceGetNormalTangent(parallax, params);
  let N = normalize(TBN * normalTangent);
  let V = viewDir;

  // Sample PBR textures
  let roughnessSample = textureSampleGrad(roughnessMap, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).g;
  let metalnessSample = textureSampleGrad(metalnessMap, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).b;
  let aoSample = textureSampleGrad(aoMap, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).r;
  let emissiveSample = textureSampleGrad(emissiveMap, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).rgb;

  // Combine with uniform values
  let metalness = uniforms.pbrParams.x * metalnessSample;
  let roughness = max(uniforms.pbrParams.y * roughnessSample, 0.04);
  let ao = mix(1.0, aoSample, uniforms.pbrParams.z);

  // Calculate F0
  let F0 = mix(vec3f(0.04), albedo, metalness);

  // Accumulate light contributions
  var Lo = vec3f(0.0);
  let lightCount = i32(uniforms.envParams.y);

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

  // Ambient lighting
  let ambientColor = uniforms.ambientLight.rgb * uniforms.ambientLight.a;
  var ambient = ambientColor * albedo * ao;

  // Environment/IBL contribution
  let envMode = uniforms.envParams.z;
  let envMapIntensity = uniforms.envParams.x;
  let maxMipLevel = uniforms.envParams.w;

  if (envMode > 1.5) {
    // Mode 2: IBL with prefilteredMap + irradianceMap (PMREM)
    ambient += calculateIBLContribution(
      N, V, albedo, metalness, roughness, F0, ao, envMapIntensity, maxMipLevel
    );
  } else if (envMode > 0.5) {
    // Mode 1: Legacy equirectangular environment map
    let R = reflect(-V, N);
    let envUV = sampleEquirectangular(R);
    let mipLevel = roughness * maxMipLevel;
    let envColor = textureSampleLevel(envMap, textureSampler, envUV, mipLevel).rgb;
    let F_env = fresnelSchlickRoughness(max(dot(N, V), 0.0), F0, roughness);
    let envContribution = envColor * F_env * envMapIntensity;
    ambient += envContribution * ao;
  }

  // Emissive contribution
  let emissiveColor = emissiveSample;

  // Final color
  var color = ambient + Lo + emissiveColor;

  // Tone mapping and gamma correction
  // For LDR content like paintings, apply lighter tone mapping
  let shouldToneMap = any(color > vec3f(1.5));
  if (shouldToneMap) {
    color = toneMapReinhard(color);
  }
  color = gammaCorrect(color);

  return vec4f(color, 1.0);
}
