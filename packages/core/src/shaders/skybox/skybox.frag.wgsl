const PI: f32 = 3.14159265359;

struct Uniforms {
  inverseViewProjection: mat4x4f,
  params: vec4f,  // x = exposure, y = roughness, z = maxMipLevel, w = mapMode (0=equirect, 1=cube)
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var envSampler: sampler;
@group(0) @binding(2) var envMapEquirect: texture_2d<f32>;       // Equirectangular map
@group(0) @binding(3) var envMapCube: texture_cube<f32>;         // Cubemap

struct FragmentInput {
  @location(0) direction: vec3f,
}

// Sample equirectangular map from direction
fn sampleEquirectangular(direction: vec3f) -> vec2f {
  let phi = atan2(direction.z, direction.x);
  let theta = asin(clamp(direction.y, -1.0, 1.0));
  let u = (phi + PI) / (2.0 * PI);
  let v = (theta + PI * 0.5) / PI;
  return vec2f(u, 1.0 - v);
}

// ACES Filmic Tone Mapping
// Reference: https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
fn acesFilm(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

// Linear to sRGB gamma correction
fn linearToSrgb(color: vec3f) -> vec3f {
  return pow(color, vec3f(1.0 / 2.2));
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  let direction = normalize(input.direction);
  let exposure = uniforms.params.x;
  let roughness = uniforms.params.y;
  let maxMipLevel = uniforms.params.z;
  let mapMode = uniforms.params.w;
  
  var color: vec3f;
  
  if (mapMode < 0.5) {
    // Equirectangular mode
    let uv = sampleEquirectangular(direction);
    let mipLevel = roughness * maxMipLevel;
    color = textureSampleLevel(envMapEquirect, envSampler, uv, mipLevel).rgb;
  } else {
    // Cubemap mode
    let mipLevel = roughness * maxMipLevel;
    color = textureSampleLevel(envMapCube, envSampler, direction, mipLevel).rgb;
  }
  
  // Apply exposure
  color = color * exposure;
  
  // Apply ACES tone mapping for HDR content
  color = acesFilm(color);
  
  // Apply gamma correction
  color = linearToSrgb(color);
  
  return vec4f(color, 1.0);
}
