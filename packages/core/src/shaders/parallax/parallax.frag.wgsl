struct Uniforms {
  mvpMatrix: mat4x4f,         // 64B offset 0
  modelMatrix: mat4x4f,       // 64B offset 64
  cameraPos: vec4f,           // 16B offset 128 (xyz = position, w unused)
  materialParams: vec4f,      // 16B offset 144 (x = depthScale, y = normalScale, z = useNormalMap, w = shininess)
  ambientLight: vec4f,        // 16B offset 160 (rgb = color, a = intensity)
  lightParams: vec4f,         // 16B offset 176 (x = lightCount, yzw = reserved)
  // lights[4]: each light is 3 vec4f (48 bytes) starting at offset 192
  light0Position: vec4f,      // 16B offset 192 (xyz = position/direction, w unused)
  light0Color: vec4f,         // 16B offset 208 (rgb = color, a = intensity)
  light0Params: vec4f,        // 16B offset 224 (x = type, y = range, z = attenType, w = attenParam)
  light1Position: vec4f,      // 16B offset 240
  light1Color: vec4f,         // 16B offset 256
  light1Params: vec4f,        // 16B offset 272
  light2Position: vec4f,      // 16B offset 288
  light2Color: vec4f,         // 16B offset 304
  light2Params: vec4f,        // 16B offset 320
  light3Position: vec4f,      // 16B offset 336
  light3Color: vec4f,         // 16B offset 352
  light3Params: vec4f,        // 16B offset 368 (total: 384B)
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
  @location(3) worldTangent: vec3f,
  @location(4) worldBitangent: vec3f,
  @location(5) viewDir: vec3f,
}

const PARALLAX_FLAG_INVERT_HEIGHT: u32 = 1u;
const PARALLAX_FLAG_GENERATE_NORMAL_FROM_DEPTH: u32 = 2u;
const PARALLAX_FLAG_SELF_SHADOW: u32 = 4u;

// Legacy packing: flags are stored in float uniform channels.
const PARALLAX_FLAGS_MAX: f32 = 255.0;

// Parallax tuning knobs (kept explicit for easy iteration).
const PARALLAX_DEPTH_EPS: f32 = 1e-6;
const PARALLAX_MIN_LAYERS: f32 = 8.0;
const PARALLAX_MAX_LAYERS: f32 = 64.0;
const PARALLAX_LAYERS_FROM_OFFSET_SCALE: f32 = 24.0;
const PARALLAX_MAX_OFFSET: f32 = 0.08;
const PARALLAX_VZ_MIN: f32 = 0.08;
const PARALLAX_ANGLE_FADE_START: f32 = 0.12;
const PARALLAX_ANGLE_FADE_END: f32 = 0.35;

struct ParallaxParams {
  depthScale: f32,
  normalScale: f32,
  useNormalMap: bool,
  shininess: f32,
  flags: u32,
  selfShadowStrength: f32,
}

// Decodes parallax feature flags packed into a float uniform channel.
// Reads uniforms.lightParams.w and converts it to a clamped u32 bitfield.
fn uniformsGetParallaxFlags() -> u32 {
  let f = clamp(round(uniforms.lightParams.w), 0.0, PARALLAX_FLAGS_MAX);
  return u32(f);
}

// Reads the self-shadow strength from uniforms and clamps it to [0, 1].
// Uses uniforms.lightParams.y as the source channel.
fn uniformsGetSelfShadowStrength() -> f32 {
  return clamp(uniforms.lightParams.y, 0.0, 1.0);
}

// Collects parallax-related parameters from the uniform buffer into a struct.
// Decodes materialParams, flags, and self-shadow strength in one place.
fn uniformsGetParallaxParams() -> ParallaxParams {
  return ParallaxParams(
    uniforms.materialParams.x,
    uniforms.materialParams.y,
    (u32(uniforms.materialParams.z) != 0u),
    uniforms.materialParams.w,
    uniformsGetParallaxFlags(),
    uniformsGetSelfShadowStrength(),
  );
}

struct ParallaxResult {
  uv: vec2f,
  uvDx: vec2f,
  uvDy: vec2f,
}

// Samples the height value from the depth/height texture.
// Applies the invert-height convention when the corresponding flag is set.
fn parallaxSampleHeight(uv: vec2f, flags: u32) -> f32 {
  let d = textureSampleLevel(depthTexture, textureSampler, uv, 0.0).r;
  if ((flags & PARALLAX_FLAG_INVERT_HEIGHT) != 0u) {
    return 1.0 - d;
  }
  return d;
}

// Computes an edge fade factor to reduce parallax near UV boundaries.
// Helps avoid tearing and clamp artifacts at the texture edges.
fn parallaxEdgeFade(inputUV: vec2f) -> f32 {
  let edge = min(min(inputUV.x, 1.0 - inputUV.x), min(inputUV.y, 1.0 - inputUV.y));
  return smoothstep(0.0, 0.05, edge);
}

// Displaces UVs by ray-marching along the view direction through the height field.
// Adapts the number of layers based on view angle and offset magnitude.
fn parallaxMapping(uv: vec2f, viewDir: vec3f, TBN: mat3x3f, params: ParallaxParams) -> vec2f {
  let viewDirTangent = normalize(transpose(TBN) * viewDir);
  if (params.depthScale <= PARALLAX_DEPTH_EPS) {
    return uv;
  }

  // Prepare step (layers + UV delta)
  let vzAbs = abs(viewDirTangent.z);
  let layersFromAngle = mix(PARALLAX_MAX_LAYERS, PARALLAX_MIN_LAYERS, vzAbs);

  // Stabilize at grazing angles + clamp max offset to reduce UV tearing.
  let angleFade = smoothstep(PARALLAX_ANGLE_FADE_START, PARALLAX_ANGLE_FADE_END, vzAbs);
  let vz = max(vzAbs, PARALLAX_VZ_MIN);
  let baseP = (viewDirTangent.xy / vz) * params.depthScale;

  let layersFromOffset = clamp(PARALLAX_MIN_LAYERS + length(baseP) * PARALLAX_LAYERS_FROM_OFFSET_SCALE, PARALLAX_MIN_LAYERS, PARALLAX_MAX_LAYERS);
  let numLayers = clamp(max(layersFromAngle, layersFromOffset), PARALLAX_MIN_LAYERS, PARALLAX_MAX_LAYERS);
  let layerDepth = 1.0 / numLayers;

  var P = baseP;
  let pLen = length(P);
  if (pLen > PARALLAX_MAX_OFFSET) {
    P *= PARALLAX_MAX_OFFSET / pLen;
  }
  P *= angleFade;
  let deltaTexCoords = P / numLayers;

  // Ray march
  var currentLayerDepth = 0.0;
  var currentTexCoords = uv;
  var currentDepthMapValue = parallaxSampleHeight(currentTexCoords, params.flags);

  for (var i = 0; i < 64; i = i + 1) {
    if (f32(i) >= numLayers) {
      break;
    }
    if (currentLayerDepth >= currentDepthMapValue) {
      break;
    }

    currentTexCoords -= deltaTexCoords;
    // Use textureSampleLevel due to non-uniform control flow.
    currentDepthMapValue = parallaxSampleHeight(currentTexCoords, params.flags);
    currentLayerDepth += layerDepth;
  }

  // Refine
  let refineSteps = select(3, 4, numLayers > 28.0);
  var aUV = currentTexCoords + deltaTexCoords;
  var bUV = currentTexCoords;
  var aDepth = currentLayerDepth - layerDepth;
  var bDepth = currentLayerDepth;

  for (var j = 0; j < 4; j = j + 1) {
    if (j >= refineSteps) {
      break;
    }

    let midUV = (aUV + bUV) * 0.5;
    let midDepth = (aDepth + bDepth) * 0.5;
    let heightMid = parallaxSampleHeight(midUV, params.flags);

    if (midDepth < heightMid) {
      aUV = midUV;
      aDepth = midDepth;
    } else {
      bUV = midUV;
      bDepth = midDepth;
    }
  }

  let heightA = parallaxSampleHeight(aUV, params.flags);
  let heightB = parallaxSampleHeight(bUV, params.flags);
  let afterDepth = heightB - bDepth;
  let beforeDepth = heightA - aDepth;

  let denom = afterDepth - beforeDepth;
  let weightUnclamped = select(afterDepth / denom, 0.5, abs(denom) < 1e-5);
  let weight = clamp(weightUnclamped, 0.0, 1.0);
  return aUV * weight + bUV * (1.0 - weight);
}

// Computes parallax-displaced UVs and their screen-space gradients (dpdx/dpdy).
// Gradients are used for stable texture sampling under non-uniform control flow.
fn parallaxComputeResult(inputUV: vec2f, viewDir: vec3f, TBN: mat3x3f, params: ParallaxParams) -> ParallaxResult {
  let displacedUV = parallaxMapping(inputUV, viewDir, TBN, params);
  let fade = parallaxEdgeFade(inputUV);
  let displacedUVClamped = clamp(displacedUV, vec2f(0.0), vec2f(1.0));
  let parallaxUV = mix(inputUV, displacedUVClamped, fade);

  let uvDx = dpdx(parallaxUV);
  let uvDy = dpdy(parallaxUV);

  return ParallaxResult(parallaxUV, uvDx, uvDy);
}

// Generates a tangent-space normal by estimating height-map gradients via Sobel.
// Used when no normal map is available to recover lighting detail from height.
fn parallaxGenerateNormalFromDepth(uv: vec2f, texelSize: vec2f, params: ParallaxParams) -> vec3f {
  let invertHeight = (params.flags & PARALLAX_FLAG_INVERT_HEIGHT) != 0u;

  let d00Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(-texelSize.x, -texelSize.y), 0.0).r;
  let d10Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(0.0, -texelSize.y), 0.0).r;
  let d20Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(texelSize.x, -texelSize.y), 0.0).r;

  let d01Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(-texelSize.x, 0.0), 0.0).r;
  let d21Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(texelSize.x, 0.0), 0.0).r;

  let d02Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(-texelSize.x, texelSize.y), 0.0).r;
  let d12Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(0.0, texelSize.y), 0.0).r;
  let d22Base = textureSampleLevel(depthTexture, textureSampler, uv + vec2f(texelSize.x, texelSize.y), 0.0).r;

  let d00 = select(d00Base, 1.0 - d00Base, invertHeight);
  let d10 = select(d10Base, 1.0 - d10Base, invertHeight);
  let d20 = select(d20Base, 1.0 - d20Base, invertHeight);

  let d01 = select(d01Base, 1.0 - d01Base, invertHeight);
  let d21 = select(d21Base, 1.0 - d21Base, invertHeight);

  let d02 = select(d02Base, 1.0 - d02Base, invertHeight);
  let d12 = select(d12Base, 1.0 - d12Base, invertHeight);
  let d22 = select(d22Base, 1.0 - d22Base, invertHeight);
  
  let dx = (d20 + 2.0 * d21 + d22) - (d00 + 2.0 * d01 + d02);
  let dy = (d02 + 2.0 * d12 + d22) - (d00 + 2.0 * d10 + d20);

  let slopeScale = params.depthScale * params.normalScale;
  return normalize(vec3f(-dx * slopeScale, -dy * slopeScale, 1.0));
}

// Samples the albedo texture using parallax-displaced UVs and explicit gradients.
// Uses textureSampleGrad to stabilize mip selection and filtering.
fn surfaceSampleAlbedo(parallax: ParallaxResult) -> vec3f {
  return textureSampleGrad(albedoTexture, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).rgb;
}

// Applies a cheap height-based self-shadow (cavity darkening) term to albedo.
// This is an approximation with controllable strength, not true shadowing.
fn surfaceApplySelfShadow(albedoIn: vec3f, parallaxUV: vec2f, viewDir: vec3f, TBN: mat3x3f, params: ParallaxParams) -> vec3f {
  if ((params.flags & PARALLAX_FLAG_SELF_SHADOW) == 0u) {
    return albedoIn;
  }

  let strength = params.selfShadowStrength;
  let Vt = transpose(TBN) * viewDir;
  let grazing = 1.0 - clamp(abs(Vt.z), 0.0, 1.0);
  let height = parallaxSampleHeight(parallaxUV, params.flags);
  let cavity = clamp(1.0 - height, 0.0, 1.0);
  let occlusion = 1.0 - cavity * strength * (0.25 + 0.75 * grazing);
  return albedoIn * clamp(occlusion, 0.0, 1.0);
}

// Resolves the tangent-space normal for shading.
// Uses the normal map if available, otherwise generates from height or falls back to (0,0,1).
fn surfaceGetNormalTangent(parallax: ParallaxResult, params: ParallaxParams) -> vec3f {
  if (params.useNormalMap) {
    let normalMapSample = textureSampleGrad(normalTexture, textureSampler, parallax.uv, parallax.uvDx, parallax.uvDy).rgb;
    var n = normalize(normalMapSample * 2.0 - 1.0);
    n = normalize(vec3f(n.x * params.normalScale, n.y * params.normalScale, n.z));
    return n;
  }

  if ((params.flags & PARALLAX_FLAG_GENERATE_NORMAL_FROM_DEPTH) != 0u) {
    let dims = vec2f(textureDimensions(depthTexture, 0));
    let texelSize = 1.0 / max(dims, vec2f(1.0));
    return parallaxGenerateNormalFromDepth(parallax.uv, texelSize, params);
  }

  return vec3f(0.0, 0.0, 1.0);
}

// Builds a stable TBN basis by re-orthonormalizing interpolated vectors.
// Restores handedness to keep the bitangent direction consistent.
fn buildTBN(worldNormal: vec3f, worldTangent: vec3f, worldBitangent: vec3f) -> mat3x3f {
  // Re-orthonormalize TBN (interpolation breaks orthogonality).
  let N = normalize(worldNormal);
  let T0 = normalize(worldTangent);
  let T = normalize(T0 - N * dot(N, T0));
  let B0 = normalize(worldBitangent);
  let handedness = select(-1.0, 1.0, dot(cross(N, T), B0) >= 0.0);
  let B = normalize(cross(N, T) * handedness);
  return mat3x3f(T, B, N);
}

// Computes Blinn-Phong lighting (diffuse + specular) for a single light.
// Supports directional and point lights with distance-based attenuation.
fn lightingCalculateBlinnPhongLight(
  lightPosition: vec4f,
  lightColor: vec4f,
  lightParams: vec4f,
  N: vec3f,
  V: vec3f,
  worldPos: vec3f,
  albedo: vec3f,
  shininess: f32
) -> vec3f {
  let lightType = lightParams.x;
  let lightRange = lightParams.y;
  let attenType = lightParams.z;
  let attenParam = lightParams.w;
  
  var L: vec3f;
  var attenuation: f32 = 1.0;
  
  if (lightType < 0.5) {
    L = normalize(-lightPosition.xyz);
  } else {
    let lightVec = lightPosition.xyz - worldPos;
    let distance = length(lightVec);
    L = normalize(lightVec);

    if (lightRange > 0.0) {
      let normalizedDist = distance / lightRange;
      if (attenType < 0.5) {
        attenuation = max(1.0 - normalizedDist, 0.0);
      } else if (attenType < 1.5) {
        let linear = max(1.0 - normalizedDist, 0.0);
        attenuation = linear * linear;
      } else {
        attenuation = 1.0 / (1.0 + normalizedDist * normalizedDist * attenParam);
      }
    }
  }
  
  let NdotL = max(dot(N, L), 0.0);
  let diffuse = NdotL * albedo * lightColor.rgb * lightColor.a;
  
  let H = normalize(L + V);
  let NdotH = max(dot(N, H), 0.0);
  let specular = pow(NdotH, shininess) * lightColor.rgb * lightColor.a;
  
  return (diffuse + specular) * attenuation;
}

// Conditionally accumulates a light contribution when enabled.
// Keeps call sites simple and avoids unnecessary work when disabled.
fn lightingAccumulateLight(
  enabled: bool,
  lightPosition: vec4f,
  lightColor: vec4f,
  lightParams: vec4f,
  N: vec3f,
  V: vec3f,
  worldPos: vec3f,
  albedo: vec3f,
  shininess: f32
) -> vec3f {
  if (!enabled) {
    return vec3f(0.0);
  }
  return lightingCalculateBlinnPhongLight(
    lightPosition,
    lightColor,
    lightParams,
    N,
    V,
    worldPos,
    albedo,
    shininess
  );
}

@fragment
// Computes the final fragment color.
// Combines parallax UV displacement, surface sampling, and Blinn-Phong lighting.
fn main(input: FragmentInput) -> @location(0) vec4f {
  let TBN = buildTBN(input.worldNormal, input.worldTangent, input.worldBitangent);

  let params = uniformsGetParallaxParams();
  let parallax = parallaxComputeResult(input.uv, input.viewDir, TBN, params);

  let viewDir = normalize(input.viewDir);

  var albedo = surfaceSampleAlbedo(parallax);
  albedo = surfaceApplySelfShadow(albedo, parallax.uv, viewDir, TBN, params);

  let normalTangent = surfaceGetNormalTangent(parallax, params);
  
  let normal = normalize(TBN * normalTangent);
  
  let shininess = params.shininess;
  
  let ambient = albedo * uniforms.ambientLight.rgb * uniforms.ambientLight.a;
  
  var Lo = vec3f(0.0);
  let lightCount = i32(uniforms.lightParams.x);

  Lo += lightingAccumulateLight(
    lightCount > 0,
    uniforms.light0Position,
    uniforms.light0Color,
    uniforms.light0Params,
    normal,
    viewDir,
    input.worldPosition,
    albedo,
    shininess
  );

  Lo += lightingAccumulateLight(
    lightCount > 1,
    uniforms.light1Position,
    uniforms.light1Color,
    uniforms.light1Params,
    normal,
    viewDir,
    input.worldPosition,
    albedo,
    shininess
  );

  Lo += lightingAccumulateLight(
    lightCount > 2,
    uniforms.light2Position,
    uniforms.light2Color,
    uniforms.light2Params,
    normal,
    viewDir,
    input.worldPosition,
    albedo,
    shininess
  );

  Lo += lightingAccumulateLight(
    lightCount > 3,
    uniforms.light3Position,
    uniforms.light3Color,
    uniforms.light3Params,
    normal,
    viewDir,
    input.worldPosition,
    albedo,
    shininess
  );
  
  let finalColor = ambient + Lo;
  
  return vec4f(finalColor, 1.0);
}
