struct Uniforms {
  face: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var envMap: texture_cube<f32>;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let N = getCubeDirection(uniforms.face, input.uv);
  
  // Create tangent space basis
  var up = vec3f(0.0, 1.0, 0.0);
  if (abs(N.y) > 0.999) {
    up = vec3f(0.0, 0.0, 1.0);
  }
  let right = normalize(cross(up, N));
  up = normalize(cross(N, right));
  
  var irradiance = vec3f(0.0);
  var sampleCount: f32 = 0.0;
  
  // Sample hemisphere with uniform distribution
  // Delta of ~0.025 provides good quality/performance balance (~6400 samples)
  let sampleDelta: f32 = 0.025;
  for (var phi: f32 = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
    for (var theta: f32 = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
      // Spherical to cartesian (tangent space)
      let tangentSample = vec3f(
        sin(theta) * cos(phi),
        sin(theta) * sin(phi),
        cos(theta)
      );
      
      // Tangent space to world space
      let sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;
      
      // Use textureSampleLevel to avoid potential non-uniform control flow issues
      let sample = textureSampleLevel(envMap, texSampler, sampleVec, 0.0).rgb;
      irradiance += sample * cos(theta) * sin(theta);
      sampleCount += 1.0;
    }
  }
  
  if (sampleCount > 0.0) {
    irradiance = PI * irradiance / sampleCount;
  } else {
    irradiance = vec3f(0.0);
  }
  
  return vec4f(irradiance, 1.0);
}
