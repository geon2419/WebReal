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
  // light0: position, color, params
  light0Position: vec4f,
  light0Color: vec4f,        // rgb + intensity
  light0Params: vec4f,       // x = type (0=dir, 1=point), y = range, z = attenType, w = attenParam
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

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(3) tangent: vec3f,
  @location(4) bitangent: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldNormal: vec3f,
  @location(1) worldPosition: vec3f,
  @location(2) uv: vec2f,
  @location(3) worldTangent: vec3f,
  @location(4) worldBitangent: vec3f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  output.position = uniforms.mvpMatrix * vec4f(input.position, 1.0);
  
  // Transform to world space
  output.worldPosition = (uniforms.modelMatrix * vec4f(input.position, 1.0)).xyz;
  
  // Transform normal to world space using normal matrix
  output.worldNormal = normalize((uniforms.normalMatrix * vec4f(input.normal, 0.0)).xyz);
  
  // Transform tangent and bitangent to world space
  output.worldTangent = normalize((uniforms.modelMatrix * vec4f(input.tangent, 0.0)).xyz);
  output.worldBitangent = normalize((uniforms.modelMatrix * vec4f(input.bitangent, 0.0)).xyz);
  
  output.uv = input.uv;
  
  return output;
}
