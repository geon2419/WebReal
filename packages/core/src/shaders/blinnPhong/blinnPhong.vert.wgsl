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
  
  // Sample displacement map (use LOD 0 since derivatives not available in vertex stage)
  let displacement = textureSampleLevel(displacementMap, textureSampler, input.uv, 0.0).r;
  let displacementScale = uniforms.displacementParams.x;
  let displacementBias = uniforms.displacementParams.y;
  let displacementOffset = displacement * displacementScale + displacementBias;
  
  // Displace position along normal direction
  let displacedPosition = input.position + input.normal * displacementOffset;
  
  output.position = uniforms.mvpMatrix * vec4f(displacedPosition, 1.0);
  
  // Transform normal to world space using normal matrix (handles non-uniform scaling correctly)
  output.worldNormal = normalize((uniforms.normalMatrix * vec4f(input.normal, 0.0)).xyz);
  
  // Transform tangent and bitangent to world space
  output.worldTangent = normalize((uniforms.modelMatrix * vec4f(input.tangent, 0.0)).xyz);
  output.worldBitangent = normalize((uniforms.modelMatrix * vec4f(input.bitangent, 0.0)).xyz);
  
  // Pass through UV coordinates
  output.uv = input.uv;
  
  // Calculate world position for lighting calculations
  output.worldPosition = (uniforms.modelMatrix * vec4f(displacedPosition, 1.0)).xyz;
  
  return output;
}
