struct Uniforms {
  mvpMatrix: mat4x4f,
  instanceScale: vec4f,
}

struct Instance {
  position: vec3f,
  padding: f32,
  color: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(2) @binding(0) var<storage, read> instances: array<Instance>;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @builtin(instance_index) instanceIdx: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) color: vec4f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.instanceIdx];

  var output: VertexOutput;

  // Scale per-instance (uniform) and apply instance position
  let worldPos = (input.position * uniforms.instanceScale.x) + instance.position;
  output.position = uniforms.mvpMatrix * vec4f(worldPos, 1.0);
  output.normal = input.normal;
  output.color = instance.color;

  return output;
}
