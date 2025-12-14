/**
 * BRDF (Bidirectional Reflectance Distribution Function) common shader code.
 * These functions are shared across PBR-based materials.
 *
 * Contains:
 * - GGX/Trowbridge-Reitz Normal Distribution Function
 * - Schlick-GGX Geometry Function
 * - Smith's Geometry Function
 * - Schlick Fresnel Approximation
 * - Light contribution calculation with Cook-Torrance BRDF
 * - IBL contribution calculation with split-sum approximation
 */

export const BRDF_CONSTANTS = /* wgsl */ `
const PI: f32 = 3.14159265359;
`;

/**
 * Core BRDF functions for physically-based rendering.
 * Implements Cook-Torrance specular BRDF with GGX distribution.
 */
export const BRDF_FUNCTIONS = /* wgsl */ `
// GGX/Trowbridge-Reitz Normal Distribution Function
fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let NdotH = max(dot(N, H), 0.0);
  let NdotH2 = NdotH * NdotH;
  
  let denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

// Schlick-GGX Geometry Function (single direction)
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

// Smith's Geometry Function (combined view and light directions)
fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
  let NdotV = max(dot(N, V), 0.0);
  let NdotL = max(dot(N, L), 0.0);
  let ggx1 = geometrySchlickGGX(NdotV, roughness);
  let ggx2 = geometrySchlickGGX(NdotL, roughness);
  return ggx1 * ggx2;
}

// Schlick Fresnel Approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Schlick Fresnel with roughness for IBL
fn fresnelSchlickRoughness(cosTheta: f32, F0: vec3f, roughness: f32) -> vec3f {
  return F0 + (max(vec3f(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}
`;

/**
 * Light attenuation calculation for point lights.
 */
export const BRDF_ATTENUATION = /* wgsl */ `
// Calculate attenuation for point lights
fn calculateAttenuation(distance: f32, range: f32, attenuationType: f32, param: f32) -> f32 {
  let normalizedDist = distance / range;
  
  if (attenuationType < 0.5) {
    // Linear: 1 - d/range
    return max(1.0 - normalizedDist, 0.0);
  } else if (attenuationType < 1.5) {
    // Quadratic: (1 - d/range)^2
    let linear = max(1.0 - normalizedDist, 0.0);
    return linear * linear;
  } else {
    // Physical: 1 / (1 + (d/range)^2 * k)
    return 1.0 / (1.0 + normalizedDist * normalizedDist * param);
  }
}
`;

/**
 * Cook-Torrance BRDF light contribution calculation.
 * Supports both directional and point lights.
 */
export const BRDF_LIGHT_CONTRIBUTION = /* wgsl */ `
// Calculate light contribution for a single light using Cook-Torrance BRDF
fn calculateLightContribution(
  lightPosition: vec4f,
  lightColor: vec4f,
  lightParams: vec4f,
  N: vec3f,
  V: vec3f,
  worldPos: vec3f,
  albedo: vec3f,
  metalness: f32,
  roughness: f32,
  F0: vec3f
) -> vec3f {
  let lightType = lightParams.x;
  let range = lightParams.y;
  let attenuationType = lightParams.z;
  let attenuationParam = lightParams.w;
  
  var L: vec3f;
  var attenuation: f32 = 1.0;
  
  if (lightType < 0.5) {
    // Directional light: use direction directly (negate for incoming)
    L = normalize(-lightPosition.xyz);
  } else {
    // Point light: calculate direction from position
    let lightVec = lightPosition.xyz - worldPos;
    let distance = length(lightVec);
    L = normalize(lightVec);
    attenuation = calculateAttenuation(distance, range, attenuationType, attenuationParam);
  }
  
  let H = normalize(V + L);
  let radiance = lightColor.rgb * lightColor.a * attenuation;
  
  // Cook-Torrance BRDF
  let NDF = distributionGGX(N, H, roughness);
  let G = geometrySmith(N, V, L, roughness);
  let F = fresnelSchlick(max(dot(H, V), 0.0), F0);
  
  let numerator = NDF * G * F;
  let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
  let specular = numerator / denominator;
  
  // Energy conservation: diffuse = 1 - specular (metals have no diffuse)
  let kS = F;
  let kD = (vec3f(1.0) - kS) * (1.0 - metalness);
  
  let NdotL = max(dot(N, L), 0.0);
  
  return (kD * albedo / PI + specular) * radiance * NdotL;
}
`;

/**
 * Environment map sampling utilities.
 */
export const BRDF_ENV_SAMPLING = /* wgsl */ `
// Sample equirectangular environment map
fn sampleEquirectangular(direction: vec3f) -> vec2f {
  // Convert direction to spherical coordinates
  let phi = atan2(direction.z, direction.x);
  let theta = asin(clamp(direction.y, -1.0, 1.0));
  
  // Map to UV coordinates [0, 1]
  let u = (phi + PI) / (2.0 * PI);
  let v = (theta + PI * 0.5) / PI;
  
  return vec2f(u, 1.0 - v);
}
`;

/**
 * Tone mapping and gamma correction utilities.
 */
export const BRDF_TONE_MAPPING = /* wgsl */ `
// Reinhard tone mapping
fn toneMapReinhard(color: vec3f) -> vec3f {
  return color / (color + vec3f(1.0));
}

// Gamma correction (linear to sRGB)
fn gammaCorrect(color: vec3f) -> vec3f {
  return pow(color, vec3f(1.0 / 2.2));
}

// Combined tone mapping and gamma correction
fn finalColorCorrection(color: vec3f) -> vec3f {
  let mapped = toneMapReinhard(color);
  return gammaCorrect(mapped);
}
`;

/**
 * All BRDF functions combined for easy import.
 * Use this when you need the complete BRDF implementation.
 */
export const BRDF_ALL = [
  BRDF_CONSTANTS,
  BRDF_FUNCTIONS,
  BRDF_ATTENUATION,
  BRDF_LIGHT_CONTRIBUTION,
  BRDF_ENV_SAMPLING,
  BRDF_TONE_MAPPING,
].join("\n");
