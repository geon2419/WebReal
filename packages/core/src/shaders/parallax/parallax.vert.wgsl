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

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) tangent: vec3f,
  @location(4) bitangent: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) worldPosition: vec3f,
  @location(2) worldNormal: vec3f,
  @location(3) worldTangent: vec3f,
  @location(4) worldBitangent: vec3f,
  @location(5) viewDir: vec3f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  // Transform position
  let worldPos = (uniforms.modelMatrix * vec4f(input.position, 1.0)).xyz;
  output.position = uniforms.mvpMatrix * vec4f(input.position, 1.0);
  output.worldPosition = worldPos;
  output.uv = input.uv;
  
  // Transform normal to world space
  let worldNormal = normalize((uniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz);
  output.worldNormal = worldNormal;
  
  // Transform tangent and bitangent to world space
  let worldTangent = normalize((uniforms.modelMatrix * vec4f(input.tangent, 0.0)).xyz);
  let worldBitangent = normalize((uniforms.modelMatrix * vec4f(input.bitangent, 0.0)).xyz);
  
  output.worldTangent = worldTangent;
  output.worldBitangent = worldBitangent;
  
  // Calculate view direction in world space
  output.viewDir = normalize(uniforms.cameraPos.xyz - worldPos);
  
  return output;
}
