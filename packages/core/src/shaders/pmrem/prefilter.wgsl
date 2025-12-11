// Number of samples for importance sampling (higher = better quality but slower)
const SAMPLE_COUNT: u32 = 1024u;

struct Uniforms {
  face: u32,
  roughness: f32,
  maxMipLevel: f32,
  padding: f32,  // For 16-byte alignment
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var envMap: texture_cube<f32>;

// Van der Corput sequence
fn radicalInverse_VdC(bits_in: u32) -> f32 {
  var bits = bits_in;
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  // 2.3283064365386963e-10 is 1.0 / 2^32, used to normalize a 32-bit integer to [0,1]
  return f32(bits) * 2.3283064365386963e-10;
}

fn hammersley(i: u32, N: u32) -> vec2f {
  return vec2f(f32(i) / f32(N), radicalInverse_VdC(i));
}

fn importanceSampleGGX(Xi: vec2f, N: vec3f, roughness: f32) -> vec3f {
  let a = roughness * roughness;
  
  let phi = 2.0 * PI * Xi.x;
  let cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  
  let H = vec3f(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
  
  var up = vec3f(0.0, 0.0, 1.0);
  if (abs(N.z) > 0.999) {
    up = vec3f(1.0, 0.0, 0.0);
  }
  let tangent = normalize(cross(up, N));
  let bitangent = cross(N, tangent);
  
  return normalize(tangent * H.x + bitangent * H.y + N * H.z);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let N = getCubeDirection(uniforms.face, input.uv);
  let R = N;
  let V = R;
  
  var prefilteredColor = vec3f(0.0);
  var totalWeight: f32 = 0.0;
  
  let roughness = max(uniforms.roughness, 0.001);
  let lod = roughness * uniforms.maxMipLevel;
  
  for (var i: u32 = 0u; i < SAMPLE_COUNT; i++) {
    let Xi = hammersley(i, SAMPLE_COUNT);
    let H = importanceSampleGGX(Xi, N, roughness);
    let L = normalize(2.0 * dot(V, H) * H - V);
    
    // Use textureSampleLevel to ensure consistent behavior in loops and avoid implicit derivative calculations,
    // which can cause issues in fragment shaders (e.g., inside loops or non-uniform control flow).
    let sample = textureSampleLevel(envMap, texSampler, L, lod).rgb;
    
    let NdotL = max(dot(N, L), 0.0);
    // Use select() to avoid branching - maintains uniform control flow
    let weight = select(0.0, NdotL, NdotL > 0.0);
    prefilteredColor += sample * weight;
    totalWeight += weight;
  }
  
  if (totalWeight > 0.0) {
    prefilteredColor = prefilteredColor / totalWeight;
  } else {
    prefilteredColor = vec3f(0.0);
  }
  
  return vec4f(prefilteredColor, 1.0);
}
