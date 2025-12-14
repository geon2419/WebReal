struct Uniforms {
  mvpMatrix: mat4x4f,         // 0-64: MVP matrix (renderer)
  modelMatrix: mat4x4f,       // 64-128: model matrix
  normalMatrix: mat4x4f,      // 128-192: normal matrix
  cameraPosition: vec4f,      // 192-208: camera position (xyz, w unused)
  pbrParams: vec4f,           // 208-224: metalness, roughness, aoIntensity, normalScale
  parallaxParams: vec4f,      // 224-240: depthScale, selfShadowStrength, flags, hasNormalMap
  envParams: vec4f,           // 240-256: envMapIntensity, lightCount, envMode, maxMipLevel
  ambientLight: vec4f,        // 256-272: rgb + intensity
  // lights[4]: each light is 3 vec4f (48 bytes) starting at offset 272
  light0Position: vec4f,
  light0Color: vec4f,
  light0Params: vec4f,
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

struct TBN {
  N: vec3f,
  T: vec3f,
  B: vec3f,
}

// Extracts the 3x3 rotation/scale matrix from the 4x4 model matrix.
fn modelMatrix3(modelMatrix: mat4x4f) -> mat3x3f {
  return mat3x3f(
    modelMatrix[0].xyz,
    modelMatrix[1].xyz,
    modelMatrix[2].xyz
  );
}

// Transforms a position from local space to world space.
fn worldPosition(modelMatrix: mat4x4f, localPosition: vec3f) -> vec3f {
  return (modelMatrix * vec4f(localPosition, 1.0)).xyz;
}

// Transforms a position from local space to clip space.
fn clipPosition(mvpMatrix: mat4x4f, localPosition: vec3f) -> vec4f {
  return mvpMatrix * vec4f(localPosition, 1.0);
}

// Transforms a normal vector from local space to world space and normalizes it.
fn worldNormal(model3: mat3x3f, localNormal: vec3f) -> vec3f {
  return normalize(model3 * localNormal);
}

// Computes the TBN (Tangent, Bitangent, Normal) matrix in world space.
// Used for tangent space transformations such as normal mapping.
fn worldTBN(model3: mat3x3f, localNormal: vec3f, localTangent: vec3f, localBitangent: vec3f) -> TBN {
  let N = worldNormal(model3, localNormal);
  let T_in = normalize(model3 * localTangent);
  let B_in = normalize(model3 * localBitangent);
  let T = normalize(T_in - N * dot(N, T_in));
  let handedness = select(-1.0, 1.0, dot(cross(N, T), B_in) >= 0.0);
  let B = normalize(cross(N, T) * handedness);
  return TBN(N, T, B);
}

// Vertex shader main function.
// Transforms vertex position, normal, and TBN vectors to world space and passes them to the fragment shader.
@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let model3 = modelMatrix3(uniforms.modelMatrix);

  let worldPos = worldPosition(uniforms.modelMatrix, input.position);
  output.position = clipPosition(uniforms.mvpMatrix, input.position);
  output.worldPosition = worldPos;
  output.uv = input.uv;

  let tbn = worldTBN(model3, input.normal, input.tangent, input.bitangent);
  output.worldNormal = tbn.N;
  output.worldTangent = tbn.T;
  output.worldBitangent = tbn.B;

  output.viewDir = uniforms.cameraPosition.xyz - worldPos;

  return output;
}
