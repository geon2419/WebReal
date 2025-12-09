struct Uniforms {
  mvpMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  normalMatrix: mat4x4f,      // inverse transpose of model matrix for correct normal transformation
  colorAndShininess: vec4f,
  lightPosition: vec4f,       // xyz = position (point) or direction (directional)
  lightColor: vec4f,          // rgb = color, a = intensity
  cameraPosition: vec4f,
  lightParams: vec4f,         // x = range, y = attenuation param
  lightTypes: vec4f,          // x = light type (0=directional, 1=point), y = attenuation type (0=linear, 1=quadratic, 2=physical)
  displacementParams: vec4f,  // x = scale, y = bias, z = normalScale, w = unused
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var displacementMap: texture_2d<f32>;
@group(0) @binding(3) var normalMap: texture_2d<f32>;

struct FragmentInput {
  @location(0) worldNormal: vec3f,
  @location(1) worldPosition: vec3f,
  @location(2) uv: vec2f,
  @location(3) worldTangent: vec3f,
  @location(4) worldBitangent: vec3f,
}

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

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  // Construct TBN matrix (tangent space to world space)
  let T = normalize(input.worldTangent);
  let B = normalize(input.worldBitangent);
  let N = normalize(input.worldNormal);
  let TBN = mat3x3f(T, B, N);
  
  // Sample normal map and convert from [0,1] to [-1,1]
  let normalMapSample = textureSample(normalMap, textureSampler, input.uv).rgb;
  var normalTangent = normalMapSample * 2.0 - 1.0;
  
  // Apply normal scale to X and Y components (Z stays as is for proper normalization)
  let normalScale = uniforms.displacementParams.z;
  normalTangent = vec3f(normalTangent.x * normalScale, normalTangent.y * normalScale, normalTangent.z);
  normalTangent = normalize(normalTangent);
  
  // Transform normal from tangent space to world space
  let normal = normalize(TBN * normalTangent);
  
  let viewDir = normalize(uniforms.cameraPosition.xyz - input.worldPosition);
  
  var lightDir: vec3f;
  var attenuation: f32 = 1.0;
  
  let lightType = uniforms.lightTypes.x;
  let attenuationType = uniforms.lightTypes.y;
  
  if (lightType < 0.5) {
    // Directional light: use direction directly (negate for incoming direction)
    lightDir = normalize(-uniforms.lightPosition.xyz);
  } else {
    // Point light: calculate direction from position to fragment
    let lightVec = uniforms.lightPosition.xyz - input.worldPosition;
    let distance = length(lightVec);
    lightDir = normalize(lightVec);
    
    // Calculate attenuation
    let range = uniforms.lightParams.x;
    let param = uniforms.lightParams.y;
    attenuation = calculateAttenuation(distance, range, attenuationType, param);
  }
  
  let ambient = 0.1;
  
  // Diffuse (Lambertian)
  let NdotL = max(dot(normal, lightDir), 0.0);
  let diffuse = NdotL * uniforms.lightColor.rgb * uniforms.lightColor.a * attenuation;
  
  // Specular (Blinn-Phong)
  let halfVector = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfVector), 0.0);
  let shininess = uniforms.colorAndShininess.a;
  let specular = pow(NdotH, shininess) * uniforms.lightColor.rgb * uniforms.lightColor.a * attenuation;
  
  let materialColor = uniforms.colorAndShininess.rgb;
  let finalColor = materialColor * (ambient + diffuse) + specular;
  
  return vec4f(finalColor, 1.0);
}
