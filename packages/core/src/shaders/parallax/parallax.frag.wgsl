struct Uniforms {
  mvpMatrix: mat4x4f,         // 64B offset 0
  modelMatrix: mat4x4f,       // 64B offset 64
  cameraPos: vec4f,           // 16B offset 128 (xyz = position, w unused)
  materialParams: vec4f,      // 16B offset 144 (x = depthScale, y = normalScale, z = useNormalMap, w = shininess)
  lightPos: vec4f,            // 16B offset 160 (xyz = position, w unused)
  lightColor: vec4f,          // 16B offset 176 (rgb = color, a = intensity)
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var textureSampler: sampler;
@group(0) @binding(2) var albedoTexture: texture_2d<f32>;
@group(0) @binding(3) var depthTexture: texture_2d<f32>;
@group(0) @binding(4) var normalTexture: texture_2d<f32>;

struct FragmentInput {
  @location(0) uv: vec2f,
  @location(1) worldPosition: vec3f,
  @location(2) worldNormal: vec3f,
  @location(3) tangent: vec3f,
  @location(4) bitangent: vec3f,
  @location(5) viewDir: vec3f,
}

// Steep Parallax Mapping with Parallax Occlusion
fn parallaxMapping(uv: vec2f, viewDir: vec3f, TBN: mat3x3f) -> vec2f {
  // Transform view direction to tangent space
  let viewDirTangent = normalize(transpose(TBN) * viewDir);
  
  // Number of layers for steep parallax
  let minLayers = 8.0;
  let maxLayers = 32.0;
  let numLayers = mix(maxLayers, minLayers, abs(dot(vec3f(0.0, 0.0, 1.0), viewDirTangent)));
  
  // Calculate the size of each layer
  let layerDepth = 1.0 / numLayers;
  var currentLayerDepth = 0.0;
  
  // The amount to shift the texture coordinates per layer
  let P = viewDirTangent.xy * uniforms.materialParams.x;
  let deltaTexCoords = P / numLayers;
  
  // Initial values
  var currentTexCoords = uv;
  var currentDepthMapValue = textureSample(depthTexture, textureSampler, currentTexCoords).r;
  
  // Steep parallax mapping loop
  for (var i = 0; i < 32; i = i + 1) {
    if (currentLayerDepth >= currentDepthMapValue) {
      break;
    }
    
    // Shift texture coordinates along direction of P
    currentTexCoords -= deltaTexCoords;
    // Get depth map value at current texture coordinates
    currentDepthMapValue = textureSample(depthTexture, textureSampler, currentTexCoords).r;
    // Get depth of next layer
    currentLayerDepth += layerDepth;
  }
  
  // Parallax occlusion mapping - interpolation between layers
  let prevTexCoords = currentTexCoords + deltaTexCoords;
  
  let afterDepth = currentDepthMapValue - currentLayerDepth;
  let beforeDepth = textureSample(depthTexture, textureSampler, prevTexCoords).r - currentLayerDepth + layerDepth;
  
  let weight = afterDepth / (afterDepth - beforeDepth);
  let finalTexCoords = prevTexCoords * weight + currentTexCoords * (1.0 - weight);
  
  return finalTexCoords;
}

// Generate normal from depth map using Sobel filter
fn generateNormalFromDepth(uv: vec2f, texelSize: vec2f) -> vec3f {
  // Sample surrounding depth values
  let d00 = textureSample(depthTexture, textureSampler, uv + vec2f(-texelSize.x, -texelSize.y)).r;
  let d10 = textureSample(depthTexture, textureSampler, uv + vec2f(0.0, -texelSize.y)).r;
  let d20 = textureSample(depthTexture, textureSampler, uv + vec2f(texelSize.x, -texelSize.y)).r;
  
  let d01 = textureSample(depthTexture, textureSampler, uv + vec2f(-texelSize.x, 0.0)).r;
  let d21 = textureSample(depthTexture, textureSampler, uv + vec2f(texelSize.x, 0.0)).r;
  
  let d02 = textureSample(depthTexture, textureSampler, uv + vec2f(-texelSize.x, texelSize.y)).r;
  let d12 = textureSample(depthTexture, textureSampler, uv + vec2f(0.0, texelSize.y)).r;
  let d22 = textureSample(depthTexture, textureSampler, uv + vec2f(texelSize.x, texelSize.y)).r;
  
  // Sobel operator
  let dx = (d20 + 2.0 * d21 + d22) - (d00 + 2.0 * d01 + d02);
  let dy = (d02 + 2.0 * d12 + d22) - (d00 + 2.0 * d10 + d20);
  
  // Create normal (x, y components from gradients, z pointing up)
  return normalize(vec3f(-dx * uniforms.materialParams.y, -dy * uniforms.materialParams.y, 1.0));
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  // Construct TBN matrix (tangent space to world space)
  let T = normalize(input.tangent);
  let B = normalize(input.bitangent);
  let N = normalize(input.worldNormal);
  let TBN = mat3x3f(T, B, N);
  
  // Apply parallax mapping
  let parallaxUV = parallaxMapping(input.uv, input.viewDir, TBN);
  
  // Discard fragments outside texture bounds (parallax edge fix)
  if (parallaxUV.x < 0.0 || parallaxUV.x > 1.0 || parallaxUV.y < 0.0 || parallaxUV.y > 1.0) {
    discard;
  }
  
  // Sample albedo texture with parallax-adjusted UV
  let albedo = textureSample(albedoTexture, textureSampler, parallaxUV).rgb;
  
  // Get normal from normal map or generate from depth
  var normalTangent: vec3f;
  if (u32(uniforms.materialParams.z) != 0u) {
    // Sample normal map and convert from [0,1] to [-1,1]
    let normalMapSample = textureSample(normalTexture, textureSampler, parallaxUV).rgb;
    normalTangent = normalize(normalMapSample * 2.0 - 1.0);
    normalTangent = vec3f(normalTangent.x * uniforms.materialParams.y, normalTangent.y * uniforms.materialParams.y, normalTangent.z);
  } else {
    // Generate normal from depth map
    let texelSize = vec2f(1.0 / 1024.0); // Approximate texture size
    normalTangent = generateNormalFromDepth(parallaxUV, texelSize);
  }
  
  // Transform normal from tangent space to world space
  let normal = normalize(TBN * normalTangent);
  
  // Blinn-Phong lighting
  let lightDir = normalize(uniforms.lightPos.xyz - input.worldPosition);
  let viewDir = normalize(input.viewDir);
  
  // Ambient
  let ambient = albedo * 0.1;
  
  // Diffuse
  let diffuseStrength = max(dot(normal, lightDir), 0.0);
  let diffuse = diffuseStrength * albedo * uniforms.lightColor.rgb * uniforms.lightColor.a;
  
  // Specular (Blinn-Phong)
  let halfDir = normalize(lightDir + viewDir);
  let specularStrength = pow(max(dot(normal, halfDir), 0.0), uniforms.materialParams.w);
  let specular = specularStrength * uniforms.lightColor.rgb * uniforms.lightColor.a;
  
  // Combine lighting
  let finalColor = ambient + diffuse + specular;
  
  return vec4f(finalColor, 1.0);
}
