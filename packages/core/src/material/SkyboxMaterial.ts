import type { Material, VertexBufferLayout, RenderContext } from "./Material";
import { ShaderLib } from "../shaders";
import type { Texture } from "../texture";
import type { CubeTexture } from "../texture/CubeTexture";
import { DummyTextures } from "../texture";

export interface SkyboxMaterialOptions {
  /** Equirectangular environment map texture (2:1 aspect ratio HDR/LDR panorama) */
  equirectangularMap?: Texture;
  /** Cubemap environment texture */
  cubeMap?: CubeTexture;
  /** Exposure value for HDR tone mapping (default: 1.0) */
  exposure?: number;
  /** Roughness value for blur effect via mip level sampling (default: 0.0) */
  roughness?: number;
}

/**
 * Material for rendering environment skybox backgrounds.
 * Supports both equirectangular (2:1 panorama) and cubemap textures.
 * Features ACES tone mapping, exposure control, and roughness-based blur.
 *
 * @example
 * ```ts
 * // Using equirectangular HDR panorama
 * const hdrTexture = await HDRLoader.load(device, 'environment.hdr');
 * const skyboxMaterial = new SkyboxMaterial({
 *   equirectangularMap: hdrTexture,
 *   exposure: 1.5,
 *   roughness: 0.0
 * });
 *
 * // Using cubemap (e.g., from PMREMGenerator)
 * const pmrem = await PMREMGenerator.fromEquirectangular(device, hdrTexture);
 * const skyboxMaterial = new SkyboxMaterial({
 *   cubeMap: pmrem.prefilteredMap,
 *   exposure: 1.0,
 *   roughness: 0.2  // Slight blur effect
 * });
 * ```
 */
export class SkyboxMaterial implements Material {
  readonly type = "skybox";

  private _equirectangularMap?: Texture;
  private _cubeMap?: CubeTexture;
  private _exposure: number;
  private _roughness: number;

  /**
   * Creates a new SkyboxMaterial with the specified environment map.
   * @param options - Material configuration including environment map and rendering parameters
   */
  constructor(options: SkyboxMaterialOptions = {}) {
    this._equirectangularMap = options.equirectangularMap;
    this._cubeMap = options.cubeMap;
    this._exposure = options.exposure ?? 1.0;
    this._roughness = options.roughness ?? 0.0;
  }

  // Getters
  get equirectangularMap(): Texture | undefined {
    return this._equirectangularMap;
  }

  get cubeMap(): CubeTexture | undefined {
    return this._cubeMap;
  }

  get exposure(): number {
    return this._exposure;
  }

  get roughness(): number {
    return this._roughness;
  }

  /**
   * Returns whether this material uses a cubemap (true) or equirectangular map (false).
   */
  get useCubeMap(): boolean {
    return !!this._cubeMap;
  }

  /**
   * Sets the exposure value for HDR tone mapping.
   * @param value - Exposure multiplier (must be positive)
   */
  setExposure(value: number): void {
    if (value <= 0) {
      throw new Error("Exposure must be greater than 0");
    }
    this._exposure = value;
  }

  /**
   * Sets the roughness value for blur effect.
   * @param value - Roughness value between 0 (sharp) and 1 (maximum blur)
   */
  setRoughness(value: number): void {
    if (value < 0 || value > 1) {
      throw new Error("Roughness must be between 0 and 1");
    }
    this._roughness = value;
  }

  /**
   * Sets the equirectangular environment map.
   * @param texture - The equirectangular texture to use
   */
  setEquirectangularMap(texture: Texture): void {
    this._equirectangularMap = texture;
    this._cubeMap = undefined;
  }

  /**
   * Sets the cubemap environment texture.
   * @param texture - The cubemap texture to use
   */
  setCubeMap(texture: CubeTexture): void {
    this._cubeMap = texture;
    this._equirectangularMap = undefined;
  }

  /**
   * Gets the WGSL vertex shader code for skybox rendering.
   * @returns WGSL vertex shader source code
   */
  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  /**
   * Gets the WGSL fragment shader code for skybox rendering.
   * @returns WGSL fragment shader source code
   */
  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  /**
   * Gets the vertex buffer layout for skybox rendering.
   * Returns empty layout as skybox uses fullscreen triangle without vertex attributes.
   * @returns Empty vertex buffer layout
   */
  getVertexBufferLayout(): VertexBufferLayout {
    // Skybox uses fullscreen triangle generated in vertex shader
    // No vertex attributes needed
    return {
      arrayStride: 0,
      attributes: [],
    };
  }

  /**
   * Gets the uniform buffer size required for this material.
   * Layout:
   * - 0-64: inverseViewProjection matrix (mat4x4f)
   * - 64-80: params (exposure, roughness, maxMipLevel, mapMode)
   *
   * @returns Size in bytes (80 bytes, aligned to 16)
   */
  getUniformBufferSize(): number {
    return 80;
  }

  /**
   * Gets the primitive topology for skybox rendering.
   * @returns "triangle-list" topology
   */
  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }

  /**
   * Gets textures for the skybox material.
   * Returns [equirectangularMap (or dummy), cubemap (or dummy)].
   * @param device - WebGPU device for creating dummy textures
   * @returns Array of textures in order: equirect, cube
   */
  getTextures(device?: GPUDevice): Texture[] {
    if (!device) {
      throw new Error(
        "SkyboxMaterial.getTextures() requires a GPUDevice parameter"
      );
    }

    const blackTex = DummyTextures.getBlack(device);

    // Return equirectangular map and cubemap
    // Shader will select based on mapMode parameter
    return [
      this._equirectangularMap ?? blackTex, // binding 2: equirectangular map
    ];
  }

  /**
   * Gets the cubemap texture for binding.
   * @returns The cubemap texture or undefined
   */
  getCubeTexture(): CubeTexture | undefined {
    return this._cubeMap;
  }

  /**
   * Writes skybox parameters to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 0)
   * @param context - Rendering context containing camera information
   */
  writeUniformData(
    buffer: DataView,
    offset: number = 0,
    context?: RenderContext
  ): void {
    // Write inverse view-projection matrix
    if (context?.camera) {
      const viewProjection = context.camera.projectionMatrix.multiply(
        context.camera.viewMatrix
      );
      const invViewProjection = viewProjection.inverse();

      for (let i = 0; i < 16; i++) {
        buffer.setFloat32(offset + i * 4, invViewProjection.data[i], true);
      }
    }

    // Write params at offset 64
    const paramsOffset = offset + 64;
    buffer.setFloat32(paramsOffset, this._exposure, true);
    buffer.setFloat32(paramsOffset + 4, this._roughness, true);

    // Calculate maxMipLevel
    let maxMipLevel = 0;
    if (this._cubeMap) {
      maxMipLevel = this._cubeMap.mipLevelCount - 1;
    } else if (this._equirectangularMap) {
      // Estimate mip levels from texture size
      const width = this._equirectangularMap.width;
      maxMipLevel = Math.floor(Math.log2(width));
    }
    buffer.setFloat32(paramsOffset + 8, maxMipLevel, true);

    // Map mode: 0 = equirectangular, 1 = cubemap
    const mapMode = this._cubeMap ? 1.0 : 0.0;
    buffer.setFloat32(paramsOffset + 12, mapMode, true);
  }
}
