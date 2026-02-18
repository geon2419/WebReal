/**
 * Number of faces in a cubemap texture.
 */
export const CUBE_FACE_COUNT = 6;

/**
 * Cube face indices matching WebGPU texture array layer order.
 *
 * @example
 * ```ts
 * // Iterate over all faces
 * for (let face = CubeFace.PositiveX; face <= CubeFace.NegativeZ; face++) {
 *   const view = cubeTexture.getFaceView(face);
 * }
 * ```
 */
export enum CubeFace {
  PositiveX = 0, // Right
  NegativeX = 1, // Left
  PositiveY = 2, // Top
  NegativeY = 3, // Bottom
  PositiveZ = 4, // Front
  NegativeZ = 5, // Back
}

export interface CubeTextureOptions {
  /** Texture format (default: 'rgba16float' for HDR, 'rgba8unorm' for LDR) */
  format?: GPUTextureFormat;
  /** Number of mip levels (default: calculated from size) */
  mipLevelCount?: number;
  /** Custom sampler options merged with default values */
  sampler?: Partial<GPUSamplerDescriptor>;
  /** Optional label for debugging */
  label?: string;
}

/**
 * Default sampler configuration for cube textures.
 * Uses linear filtering and clamp-to-edge addressing for seamless cubemap sampling.
 */
export const DEFAULT_CUBE_SAMPLER_OPTIONS: Readonly<GPUSamplerDescriptor> =
  Object.freeze({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
  } as const);

/**
 * WebGPU cubemap texture wrapper for environment mapping and IBL.
 *
 * A cube texture consists of 6 square faces arranged as a texture array.
 * Each face represents a direction: +X, -X, +Y, -Y, +Z, -Z.
 *
 * @example
 * ```ts
 * // Create an empty cube texture for PMREM
 * const cubeTexture = CubeTexture.createEmpty(device, 256, {
 *   format: 'rgba16float',
 *   mipLevelCount: 8,
 *   label: 'Environment Cubemap'
 * });
 *
 * // Get the cube view for shader binding
 * const cubeView = cubeTexture.cubeView;
 *
 * // Get individual face view for rendering
 * const faceView = cubeTexture.getFaceView(CubeFace.PositiveX, 0);
 * ```
 */
export class CubeTexture {
  private _gpuTexture: GPUTexture;
  private _gpuSampler: GPUSampler;
  private _cubeView: GPUTextureView;
  private _size: number;
  private _format: GPUTextureFormat;
  private _mipLevelCount: number;
  private _faceViewCache: Map<string, GPUTextureView> = new Map();

  /**
   * Creates a new CubeTexture instance.
   * @param gpuTexture - The WebGPU texture object (must be a 2D array with 6 layers)
   * @param gpuSampler - The WebGPU sampler object
   * @param size - Size of each face (width = height)
   * @param format - The texture format
   * @param mipLevelCount - The number of mip levels
   */
  constructor(
    gpuTexture: GPUTexture,
    gpuSampler: GPUSampler,
    size: number,
    format: GPUTextureFormat = "rgba16float",
    mipLevelCount: number = 1,
  ) {
    this._gpuTexture = gpuTexture;
    this._gpuSampler = gpuSampler;
    this._size = size;
    this._format = format;
    this._mipLevelCount = mipLevelCount;

    // Create the cube view for shader binding
    this._cubeView = gpuTexture.createView({
      dimension: "cube",
      arrayLayerCount: CUBE_FACE_COUNT,
      baseArrayLayer: 0,
      mipLevelCount: mipLevelCount,
      baseMipLevel: 0,
    });
  }

  /**
   * Gets the underlying GPUTexture object.
   */
  get gpuTexture(): GPUTexture {
    return this._gpuTexture;
  }

  /**
   * Gets the underlying GPUSampler object.
   */
  get gpuSampler(): GPUSampler {
    return this._gpuSampler;
  }

  /**
   * Gets the cube texture view for shader binding.
   * This view treats all 6 faces as a single cubemap.
   */
  get cubeView(): GPUTextureView {
    return this._cubeView;
  }

  /**
   * Gets the size of each face (width = height).
   */
  get size(): number {
    return this._size;
  }

  /**
   * Gets the texture format.
   */
  get format(): GPUTextureFormat {
    return this._format;
  }

  /**
   * Gets the number of mip levels.
   */
  get mipLevelCount(): number {
    return this._mipLevelCount;
  }

  /**
   * Gets a 2D texture view for a specific face and mip level.
   * Useful for rendering to individual cubemap faces.
   *
   * @param face - The cube face to get view for
   * @param mipLevel - The mip level (default: 0)
   * @returns A 2D texture view for the specified face and mip level
   * @throws Error if mipLevel is out of range
   */
  getFaceView(face: CubeFace, mipLevel: number = 0): GPUTextureView {
    if (mipLevel < 0 || mipLevel >= this._mipLevelCount) {
      throw new Error(
        `Invalid mip level: ${mipLevel}. Must be between 0 and ${this._mipLevelCount - 1}`,
      );
    }

    const key = `${face}-${mipLevel}`;
    if (!this._faceViewCache.has(key)) {
      this._faceViewCache.set(
        key,
        this._gpuTexture.createView({
          dimension: "2d",
          baseArrayLayer: face,
          arrayLayerCount: 1,
          baseMipLevel: mipLevel,
          mipLevelCount: 1,
        }),
      );
    }
    return this._faceViewCache.get(key)!;
  }

  /**
   * Gets the size of a specific mip level.
   * @param mipLevel - The mip level
   * @returns The size at the specified mip level
   * @throws Error if mipLevel is out of range
   */
  getMipSize(mipLevel: number): number {
    if (mipLevel < 0 || mipLevel >= this._mipLevelCount) {
      throw new Error(
        `Invalid mip level: ${mipLevel}. Must be between 0 and ${this._mipLevelCount - 1}`,
      );
    }
    return Math.max(1, this._size >> mipLevel);
  }

  /**
   * Creates an empty cube texture for rendering.
   *
   * @param device - The WebGPU device
   * @param size - Size of each face (width = height, should be power of 2)
   * @param options - Optional configuration
   * @returns A new CubeTexture instance
   * @throws Error if size is invalid
   */
  static createEmpty(
    device: GPUDevice,
    size: number,
    options: CubeTextureOptions = {},
  ): CubeTexture {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error(`Invalid size: ${size}. Must be a positive integer.`);
    }
    if ((size & (size - 1)) !== 0) {
      console.warn(
        `Size ${size} is not a power of 2. This may cause issues with mipmaps.`,
      );
    }

    const format = options.format ?? "rgba16float";
    const mipLevelCount =
      options.mipLevelCount ?? calculateCubeMipLevelCount(size);
    const label = options.label ?? "CubeTexture";

    const gpuTexture = device.createTexture({
      label,
      size: [size, size, CUBE_FACE_COUNT],
      format,
      mipLevelCount,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_DST,
      dimension: "2d", // 2D array texture
    });

    const gpuSampler = device.createSampler({
      ...DEFAULT_CUBE_SAMPLER_OPTIONS,
      ...options.sampler,
      label: `${label}:Sampler`,
    });

    return new CubeTexture(gpuTexture, gpuSampler, size, format, mipLevelCount);
  }

  /**
   * Destroys the GPU texture resources and clears cached views.
   */
  destroy(): void {
    this._faceViewCache.clear();
    this._gpuTexture.destroy();
  }
}

/**
 * Calculates the number of mip levels for a cube texture.
 * @param size - The size of each face
 * @returns The number of mip levels
 */
export function calculateCubeMipLevelCount(size: number): number {
  return Math.floor(Math.log2(size)) + 1;
}

/**
 * Direction vector type for cube face coordinate transformation.
 */
type CubeFaceDirection = {
  readonly forward: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly right: readonly [number, number, number];
};

/**
 * Direction vectors for each cube face used for cubemap sampling.
 * Each face has forward, up, and right vectors for coordinate transformation.
 *
 * @example
 * ```ts
 * const { forward, up, right } = CUBE_FACE_DIRECTIONS[CubeFace.PositiveX];
 * // forward: [1, 0, 0], up: [0, 1, 0], right: [0, 0, -1]
 * ```
 */
export const CUBE_FACE_DIRECTIONS: Readonly<
  Record<CubeFace, CubeFaceDirection>
> = Object.freeze({
  [CubeFace.PositiveX]: {
    forward: [1, 0, 0] as const,
    up: [0, 1, 0] as const,
    right: [0, 0, -1] as const,
  },
  [CubeFace.NegativeX]: {
    forward: [-1, 0, 0] as const,
    up: [0, 1, 0] as const,
    right: [0, 0, 1] as const,
  },
  [CubeFace.PositiveY]: {
    forward: [0, 1, 0] as const,
    up: [0, 0, -1] as const,
    right: [1, 0, 0] as const,
  },
  [CubeFace.NegativeY]: {
    forward: [0, -1, 0] as const,
    up: [0, 0, 1] as const,
    right: [1, 0, 0] as const,
  },
  [CubeFace.PositiveZ]: {
    forward: [0, 0, 1] as const,
    up: [0, 1, 0] as const,
    right: [1, 0, 0] as const,
  },
  [CubeFace.NegativeZ]: {
    forward: [0, 0, -1] as const,
    up: [0, 1, 0] as const,
    right: [-1, 0, 0] as const,
  },
} as const);
