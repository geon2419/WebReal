import type { Material, VertexBufferLayout, RenderContext } from "./Material";
import { ShaderLib } from "../shaders";
import { Texture, DEFAULT_SAMPLER_OPTIONS } from "../texture";
import type { CubeTexture } from "../texture";
import { PointLight } from "../light/PointLight";
import { DirectionalLight } from "../light/DirectionalLight";
import { AmbientLight } from "../light/AmbientLight";
import { BRDFLut } from "../texture/BRDFLut";
import { DummyTextures } from "../texture/DummyTextures";

/**
 * Options for creating a ParallaxPBRMaterial.
 */
export interface ParallaxPBRMaterialOptions {
  /** Albedo/base color texture (required) */
  albedo: Texture;
  /** Depth/height map texture for parallax effect (required) */
  depth: Texture;
  /** Normal map texture (optional, can be generated from depth) */
  normal?: Texture;
  /** Roughness texture - uses green channel (optional, uses roughness uniform if not provided) */
  roughnessMap?: Texture;
  /** Metalness texture - uses blue channel (optional, uses metalness uniform if not provided) */
  metalnessMap?: Texture;
  /** Ambient occlusion texture - uses red channel (optional) */
  aoMap?: Texture;
  /** Emissive texture (optional) */
  emissiveMap?: Texture;
  /** Equirectangular environment map for reflections (optional, legacy mode) */
  envMap?: Texture;
  /** Pre-filtered environment cubemap for specular IBL (optional, from PMREMGenerator) */
  prefilteredMap?: CubeTexture;
  /** Irradiance cubemap for diffuse IBL (optional, from PMREMGenerator) */
  irradianceMap?: CubeTexture;
  /** BRDF integration LUT (optional, auto-uses shared LUT if not provided) */
  brdfLUT?: Texture;

  // PBR parameters
  /** Metalness factor 0.0 (dielectric) to 1.0 (metal) @default 0.0 */
  metalness?: number;
  /** Roughness factor 0.0 (smooth) to 1.0 (rough) @default 0.5 */
  roughness?: number;
  /** AO map intensity @default 1.0 */
  aoMapIntensity?: number;
  /** Environment map intensity @default 1.0 */
  envMapIntensity?: number;

  // Parallax parameters
  /** Depth scale for parallax effect @default 0.05 */
  depthScale?: number;
  /** Normal map intensity @default 1.0 */
  normalScale?: number;
  /** Generate normal from depth map if no normal texture provided @default true */
  generateNormalFromDepth?: boolean;
  /** Enable self-shadow (inner shadow) effect @default false */
  selfShadow?: boolean;
  /** Self-shadow strength @default 0.35 */
  selfShadowStrength?: number;
  /** Height sampling convention: height = 1 - depth.r @default true */
  invertHeight?: boolean;
}

/**
 * Parallax Occlusion Mapping material with Physically Based Rendering.
 * Combines 2.5D parallax depth effects with Cook-Torrance BRDF lighting for realistic surface detail.
 *
 * @example
 * ```ts
 * const material = new ParallaxPBRMaterial({
 *   albedo: albedoTexture,
 *   depth: depthTexture,
 *   roughness: 0.7,
 *   metalness: 0.0,
 *   depthScale: 0.05, // Controls parallax depth
 * });
 * ```
 */
export class ParallaxPBRMaterial implements Material {
  readonly type = "parallaxPbr";

  readonly albedo: Texture;
  readonly depth: Texture;
  readonly normal?: Texture;
  readonly roughnessMap?: Texture;
  readonly metalnessMap?: Texture;
  readonly aoMap?: Texture;
  readonly emissiveMap?: Texture;
  readonly envMap?: Texture;
  readonly prefilteredMap?: CubeTexture;
  readonly irradianceMap?: CubeTexture;
  private _brdfLUT?: Texture;

  private _metalness: number;
  private _roughness: number;
  private _aoMapIntensity: number;
  private _envMapIntensity: number;

  private _depthScale: number;
  private _normalScale: number;
  readonly generateNormalFromDepth: boolean;
  private _selfShadow: boolean;
  private _selfShadowStrength: number;
  readonly invertHeight: boolean;

  private static _dummyNormalTexture?: Texture;

  /**
   * Creates a new ParallaxPBRMaterial instance with the specified textures and parameters.
   * @param options - Configuration options including textures and PBR parameters
   */
  constructor(options: ParallaxPBRMaterialOptions) {
    // Required textures
    this.albedo = options.albedo;
    this.depth = options.depth;

    // Optional textures
    this.normal = options.normal;
    this.roughnessMap = options.roughnessMap;
    this.metalnessMap = options.metalnessMap;
    this.aoMap = options.aoMap;
    this.emissiveMap = options.emissiveMap;
    this.envMap = options.envMap;
    this.prefilteredMap = options.prefilteredMap;
    this.irradianceMap = options.irradianceMap;
    this._brdfLUT = options.brdfLUT;

    // PBR parameters
    this._metalness = options.metalness ?? 0.0;
    this._roughness = options.roughness ?? 0.5;
    this._aoMapIntensity = options.aoMapIntensity ?? 1.0;
    this._envMapIntensity = options.envMapIntensity ?? 1.0;

    // Parallax parameters
    this._depthScale = options.depthScale ?? 0.05;
    this._normalScale = options.normalScale ?? 1.0;
    this.generateNormalFromDepth = options.generateNormalFromDepth ?? true;
    this._selfShadow = options.selfShadow ?? false;
    this._selfShadowStrength = options.selfShadowStrength ?? 0.35;
    this.invertHeight = options.invertHeight ?? true;

    this._validateRanges();
  }

  /**
   * Validates parallax parameter ranges and logs warnings for values outside recommended ranges.
   */
  private _validateRanges(): void {
    if (this._depthScale < 0.01 || this._depthScale > 0.15) {
      console.warn(
        `ParallaxPBRMaterial: depthScale ${this._depthScale} is outside recommended range (0.01-0.15)`
      );
    }
    if (this._normalScale < 0.0 || this._normalScale > 3.0) {
      console.warn(
        `ParallaxPBRMaterial: normalScale ${this._normalScale} is outside recommended range (0.0-3.0)`
      );
    }
  }

  /**
   * Gets the metalness factor.
   * @returns Value from 0.0 (dielectric) to 1.0 (metal)
   */
  get metalness(): number {
    return this._metalness;
  }

  set metalness(value: number) {
    if (value < 0 || value > 1) {
      throw new Error("Metalness must be between 0 and 1");
    }
    this._metalness = value;
  }

  /**
   * Gets the roughness factor.
   * @returns Value from 0.0 (smooth) to 1.0 (rough)
   */
  get roughness(): number {
    return this._roughness;
  }

  set roughness(value: number) {
    if (value < 0 || value > 1) {
      throw new Error("Roughness must be between 0 and 1");
    }
    this._roughness = value;
  }

  /**
   * Gets the ambient occlusion map intensity.
   * @returns Value from 0.0 to 1.0 controlling AO effect strength
   */
  get aoMapIntensity(): number {
    return this._aoMapIntensity;
  }

  set aoMapIntensity(value: number) {
    if (value < 0 || value > 1) {
      throw new Error("AO map intensity must be between 0 and 1");
    }
    this._aoMapIntensity = value;
  }

  /**
   * Gets the environment map intensity.
   * @returns Non-negative value controlling reflection strength
   */
  get envMapIntensity(): number {
    return this._envMapIntensity;
  }

  set envMapIntensity(value: number) {
    if (value < 0) {
      throw new Error("Environment map intensity must be non-negative");
    }
    this._envMapIntensity = value;
  }

  /**
   * Gets the depth scale for parallax effect.
   * @returns Value controlling parallax displacement intensity (recommended: 0.01-0.15)
   */
  get depthScale(): number {
    return this._depthScale;
  }

  set depthScale(value: number) {
    if (value < 0.01 || value > 0.15) {
      console.warn(
        `ParallaxPBRMaterial: depthScale ${value} is outside recommended range (0.01-0.15)`
      );
    }
    this._depthScale = value;
  }

  /**
   * Gets the normal map intensity.
   * @returns Value controlling normal map effect strength (recommended: 0.0-3.0)
   */
  get normalScale(): number {
    return this._normalScale;
  }

  set normalScale(value: number) {
    if (value < 0.0 || value > 3.0) {
      console.warn(
        `ParallaxPBRMaterial: normalScale ${value} is outside recommended range (0.0-3.0)`
      );
    }
    this._normalScale = value;
  }

  /**
   * Gets whether self-shadow (inner shadow) is enabled.
   * @returns true if self-shadow effect is active
   */
  get selfShadow(): boolean {
    return this._selfShadow;
  }

  set selfShadow(value: boolean) {
    this._selfShadow = value;
  }

  /**
   * Gets the self-shadow strength.
   * @returns Value from 0.0 to 1.0 controlling shadow intensity
   */
  get selfShadowStrength(): number {
    return this._selfShadowStrength;
  }

  set selfShadowStrength(value: number) {
    if (value < 0 || value > 1) {
      console.warn(
        `ParallaxPBRMaterial: selfShadowStrength ${value} is outside recommended range (0-1)`
      );
    }
    this._selfShadowStrength = value;
  }

  /**
   * Checks if the material uses proper IBL (PMREM-based) instead of simple environment mapping.
   * @returns true if both prefilteredMap and irradianceMap are configured
   */
  get useIBL(): boolean {
    return !!(this.prefilteredMap && this.irradianceMap);
  }

  /**
   * Gets the BRDF LUT texture for split-sum approximation.
   * @param device - WebGPU device for creating the shared BRDF LUT if needed
   * @returns The BRDF LUT texture (shared instance if not explicitly set)
   */
  getBRDFLut(device: GPUDevice): Texture {
    return this._brdfLUT ?? BRDFLut.get(device);
  }

  /**
   * Gets IBL cubemap textures for physically-based image-based lighting.
   * @param device - WebGPU device for creating the shared BRDF LUT if needed
   * @returns Object with prefilteredMap, irradianceMap, and brdfLUT, or null if IBL is not configured
   */
  getIBLTextures(device: GPUDevice): {
    prefilteredMap: CubeTexture;
    irradianceMap: CubeTexture;
    brdfLUT: Texture;
  } | null {
    if (!this.prefilteredMap || !this.irradianceMap) {
      return null;
    }

    return {
      prefilteredMap: this.prefilteredMap,
      irradianceMap: this.irradianceMap,
      brdfLUT: this.getBRDFLut(device),
    };
  }

  /**
   * Gets the vertex shader source code.
   * @returns WGSL vertex shader code for parallax PBR rendering
   */
  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  /**
   * Gets the fragment shader source code.
   * @returns WGSL fragment shader code for parallax PBR rendering
   */
  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  /**
   * Gets the vertex buffer layout configuration.
   * The layout is: position (vec3, 12 bytes), normal (vec3, 12 bytes), UV (vec2, 8 bytes),
   * tangent (vec3, 12 bytes), bitangent (vec3, 12 bytes); total stride is 56 bytes.
   * @returns Layout with position, normal, UV, tangent, and bitangent attributes
   */
  getVertexBufferLayout(): VertexBufferLayout {
    return {
      arrayStride: 56,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x2" },
        { shaderLocation: 3, offset: 32, format: "float32x3" },
        { shaderLocation: 4, offset: 44, format: "float32x3" },
      ],
    };
  }

  /**
   * Gets the uniform buffer size required for this material.
   * Layout (absolute buffer positions from start):
   * - 0-64: mvpMatrix (renderer)
   * - 64-128: modelMatrix
   * - 128-192: normalMatrix
   * - 192-208: cameraPosition (xyz, w unused)
   * - 208-224: pbrParams (metalness, roughness, aoIntensity, normalScale)
   * - 224-240: parallaxParams (depthScale, selfShadowStrength, flags, hasNormalMap)
   * - 240-256: envParams (envMapIntensity, lightCount, envMode, maxMipLevel)
   * - 256-272: ambientLight (rgb + intensity)
   * - 272-464: lights[4] (48 bytes each: position 16 + color 16 + params 16)
   * - 464-512: padding
   *
   * Note: writeUniformData() receives an offset parameter (default 64) and uses relative offsets.
   * @returns Size in bytes (512 bytes total)
   */
  getUniformBufferSize(): number {
    return 512;
  }

  /**
   * Gets the primitive topology for rendering.
   * @returns "triangle-list" topology
   */
  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }

  /**
   * Creates a 1x1 default normal texture with up-facing normal.
   * The normal is encoded as RGBA (128, 128, 255, 255), representing a (0, 0, 1) tangent-space normal.
   * @param device - WebGPU device for creating the texture
   * @returns The created dummy normal texture
   */
  private static createDummyNormalTexture(device: GPUDevice): Texture {
    if (!this._dummyNormalTexture) {
      const texture = device.createTexture({
        size: [1, 1, 1],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      const data = new Uint8Array([128, 128, 255, 255]);
      device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow: 4 },
        [1, 1, 1]
      );

      const sampler = device.createSampler(DEFAULT_SAMPLER_OPTIONS);
      this._dummyNormalTexture = new Texture(
        texture,
        sampler,
        1,
        1,
        "rgba8unorm",
        1
      );
    }
    return this._dummyNormalTexture;
  }

  /**
   * Gets all textures for binding to the shader.
   * @param device - WebGPU device for creating fallback dummy textures
   * @returns Array of 8 textures in binding order: albedo, depth, normal, roughness, metalness, ao, emissive, envMap
   */
  getTextures(device: GPUDevice): Texture[] {
    const whiteTex = DummyTextures.getWhite(device);
    const normalTex =
      this.normal || ParallaxPBRMaterial.createDummyNormalTexture(device);
    const blackTex = DummyTextures.getBlack(device);

    return [
      this.albedo,
      this.depth,
      normalTex,
      this.roughnessMap ?? whiteTex,
      this.metalnessMap ?? whiteTex,
      this.aoMap ?? whiteTex,
      this.emissiveMap ?? blackTex,
      this.envMap ?? blackTex,
    ];
  }

  /**
   * Writes all uniform data to the buffer including matrices, parameters, and lights.
   * @param buffer - DataView of the uniform buffer to write to
   * @param offset - Byte offset to start writing at (default: 64, after MVP matrix)
   * @param context - Rendering context with mesh, camera, and lights
   */
  writeUniformData(
    buffer: DataView,
    offset: number = 64,
    context?: RenderContext
  ): void {
    this._writeModelMatrix(buffer, offset, context);
    this._writeNormalMatrix(buffer, offset, context);
    this._writeCameraPosition(buffer, offset, context);
    this._writePBRParams(buffer, offset);
    this._writeParallaxParams(buffer, offset);
    this._writeAmbientLight(buffer, offset, context);
    const lightCount = this._writeLights(buffer, offset, context);
    this._writeEnvParams(buffer, offset, lightCount);
  }

  /**
   * Writes the model matrix to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param context - Rendering context containing the mesh
   */
  private _writeModelMatrix(
    buffer: DataView,
    offset: number,
    context?: RenderContext
  ): void {
    if (!context?.mesh) return;

    for (let i = 0; i < 16; i++) {
      buffer.setFloat32(offset + i * 4, context.mesh.worldMatrix.data[i], true);
    }
  }

  /**
   * Writes the normal matrix (inverse transpose of model matrix) to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param context - Rendering context containing the mesh
   */
  private _writeNormalMatrix(
    buffer: DataView,
    offset: number,
    context?: RenderContext
  ): void {
    if (!context?.mesh) return;

    const normalMatrix = context.mesh.worldMatrix.inverse().transpose();
    for (let i = 0; i < 16; i++) {
      buffer.setFloat32(offset + 64 + i * 4, normalMatrix.data[i], true);
    }
  }

  /**
   * Writes the camera world position to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param context - Rendering context containing the camera
   */
  private _writeCameraPosition(
    buffer: DataView,
    offset: number,
    context?: RenderContext
  ): void {
    if (!context?.camera) return;

    const cameraWorldMatrix = context.camera.worldMatrix.data;
    buffer.setFloat32(offset + 128, cameraWorldMatrix[12], true);
    buffer.setFloat32(offset + 132, cameraWorldMatrix[13], true);
    buffer.setFloat32(offset + 136, cameraWorldMatrix[14], true);
    buffer.setFloat32(offset + 140, 0.0, true);
  }

  /**
   * Writes PBR parameters (metalness, roughness, AO intensity, normal scale) to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   */
  private _writePBRParams(buffer: DataView, offset: number): void {
    buffer.setFloat32(offset + 144, this._metalness, true);
    buffer.setFloat32(offset + 148, this._roughness, true);
    buffer.setFloat32(offset + 152, this._aoMapIntensity, true);
    buffer.setFloat32(offset + 156, this._normalScale, true);
  }

  /**
   * Writes parallax parameters (depth scale, shadow strength, flags) to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   */
  private _writeParallaxParams(buffer: DataView, offset: number): void {
    buffer.setFloat32(offset + 160, this._depthScale, true);
    buffer.setFloat32(
      offset + 164,
      this._selfShadow ? this._selfShadowStrength : 0,
      true
    );

    // Pack flags into a single float
    let flags = 0;
    if (this.invertHeight) flags |= 1;
    if (this.generateNormalFromDepth && !this.normal) flags |= 2;
    if (this._selfShadow) flags |= 4;
    buffer.setFloat32(offset + 168, flags, true);
    buffer.setFloat32(offset + 172, this.normal ? 1 : 0, true);
  }

  /**
   * Writes environment mapping parameters (intensity, light count, mode, mip level) to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param lightCount - Number of active dynamic lights
   */
  private _writeEnvParams(
    buffer: DataView,
    offset: number,
    lightCount: number
  ): void {
    let envMode = 0.0;
    let maxMipLevel = 0.0;

    if (this.useIBL) {
      envMode = 2.0;
      maxMipLevel = this.prefilteredMap!.mipLevelCount - 1;
    } else if (this.envMap) {
      envMode = 1.0;
      maxMipLevel = 8.0;
    }

    buffer.setFloat32(offset + 176, this._envMapIntensity, true);
    buffer.setFloat32(offset + 180, lightCount, true);
    buffer.setFloat32(offset + 184, envMode, true);
    buffer.setFloat32(offset + 188, maxMipLevel, true);
  }

  /**
   * Writes ambient light data to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param context - Rendering context containing lights
   */
  private _writeAmbientLight(
    buffer: DataView,
    offset: number,
    context?: RenderContext
  ): void {
    let ambientLight: AmbientLight | undefined;

    if (context?.lights) {
      for (const light of context.lights) {
        if (light instanceof AmbientLight) {
          ambientLight = light;
          break;
        }
      }
    }

    if (ambientLight) {
      buffer.setFloat32(offset + 192, ambientLight.color.r, true);
      buffer.setFloat32(offset + 196, ambientLight.color.g, true);
      buffer.setFloat32(offset + 200, ambientLight.color.b, true);
      buffer.setFloat32(offset + 204, ambientLight.intensity, true);
    } else {
      buffer.setFloat32(offset + 192, 1.0, true);
      buffer.setFloat32(offset + 196, 1.0, true);
      buffer.setFloat32(offset + 200, 1.0, true);
      buffer.setFloat32(offset + 204, 0.03, true);
    }
  }

  /**
   * Writes up to 4 dynamic lights (point and directional) to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param context - Rendering context containing lights
   * @returns Number of lights written
   */
  private _writeLights(
    buffer: DataView,
    offset: number,
    context?: RenderContext
  ): number {
    const maxLights = 4;
    const lightBaseOffset = offset + 208;
    let lightIndex = 0;

    if (context?.lights) {
      for (const light of context.lights) {
        if (lightIndex >= maxLights) break;
        if (light instanceof AmbientLight) continue;

        const lightOffset = lightBaseOffset + lightIndex * 48;

        if (light instanceof DirectionalLight) {
          this._writeDirectionalLight(buffer, lightOffset, light);
          lightIndex++;
        } else if (light instanceof PointLight) {
          this._writePointLight(buffer, lightOffset, light);
          lightIndex++;
        }
      }
    }

    // Zero out remaining light slots
    for (let i = lightIndex; i < maxLights; i++) {
      const lightOffset = lightBaseOffset + i * 48;
      for (let j = 0; j < 12; j++) {
        buffer.setFloat32(lightOffset + j * 4, 0.0, true);
      }
    }

    return lightIndex;
  }

  /**
   * Writes directional light data (direction, color, intensity) to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param light - Directional light instance
   */
  private _writeDirectionalLight(
    buffer: DataView,
    offset: number,
    light: DirectionalLight
  ): void {
    buffer.setFloat32(offset, light.direction.x, true);
    buffer.setFloat32(offset + 4, light.direction.y, true);
    buffer.setFloat32(offset + 8, light.direction.z, true);
    buffer.setFloat32(offset + 12, 0.0, true);

    buffer.setFloat32(offset + 16, light.color.r, true);
    buffer.setFloat32(offset + 20, light.color.g, true);
    buffer.setFloat32(offset + 24, light.color.b, true);
    buffer.setFloat32(offset + 28, light.intensity, true);

    buffer.setFloat32(offset + 32, 0.0, true);
    buffer.setFloat32(offset + 36, 0.0, true);
    buffer.setFloat32(offset + 40, 0.0, true);
    buffer.setFloat32(offset + 44, 0.0, true);
  }

  /**
   * Writes point light data (position, color, intensity, attenuation) to the uniform buffer.
   * @param buffer - DataView to write to
   * @param offset - Byte offset in the buffer
   * @param light - Point light instance
   */
  private _writePointLight(
    buffer: DataView,
    offset: number,
    light: PointLight
  ): void {
    light.updateWorldMatrix(true, false);

    buffer.setFloat32(offset, light.worldMatrix.data[12], true);
    buffer.setFloat32(offset + 4, light.worldMatrix.data[13], true);
    buffer.setFloat32(offset + 8, light.worldMatrix.data[14], true);
    buffer.setFloat32(offset + 12, 0.0, true);

    buffer.setFloat32(offset + 16, light.color.r, true);
    buffer.setFloat32(offset + 20, light.color.g, true);
    buffer.setFloat32(offset + 24, light.color.b, true);
    buffer.setFloat32(offset + 28, light.intensity, true);

    const attenuationFactors = light.getAttenuationFactors();
    buffer.setFloat32(offset + 32, 1.0, true);
    buffer.setFloat32(offset + 36, attenuationFactors[0], true);
    buffer.setFloat32(offset + 40, attenuationFactors[3], true);
    buffer.setFloat32(offset + 44, attenuationFactors[1], true);
  }
}
