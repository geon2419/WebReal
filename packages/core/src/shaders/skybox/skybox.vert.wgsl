struct Uniforms {
  inverseViewProjection: mat4x4f,
  params: vec4f,  // x = exposure, y = roughness, z = maxMipLevel, w = mapMode (0=equirect, 1=cube)
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) direction: vec3f,
}

// Fullscreen triangle vertex shader
// Generates a single triangle that covers the entire screen
@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var output: VertexOutput;
  
  // Generate fullscreen triangle vertices
  // vertex 0: (-1, -1), vertex 1: (3, -1), vertex 2: (-1, 3)
  let x = f32((vertexIndex << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vertexIndex & 2u) * 2.0 - 1.0;
  
  // Output position at far plane (z = 1.0 in NDC, w = 1.0)
  // Setting z = w ensures depth = 1.0 after perspective division
  output.position = vec4f(x, y, 1.0, 1.0);
  
  // Calculate world direction by unprojecting clip space position
  // Use z = 1.0 (far plane) for direction calculation
  let clipPos = vec4f(x, y, 1.0, 1.0);
  let worldPos = uniforms.inverseViewProjection * clipPos;
  
  // Perspective divide and normalize to get direction
  output.direction = normalize(worldPos.xyz / worldPos.w);
  
  return output;
}
