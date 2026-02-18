import {
  MipmapGenerator,
  calculateMipLevelCount,
  isRenderableFormat,
} from "./MipmapGenerator";
import { HDRLoader } from "./HDRLoader";

// Re-export mipmap utilities for convenience
export { calculateMipLevelCount, isRenderableFormat };

/**
 * Configuration options for texture creation.
 */
export interface TextureOptions {
  /** Texture format (default: 'rgba8unorm'). Only 'rgba8unorm', 'rgba8unorm-srgb', 'bgra8unorm', 'bgra8unorm-srgb' supported with fromURL() */
  format?: GPUTextureFormat;

  /** Automatically convert format to sRGB variant for gamma correction (default: false) */
  srgb?: boolean;

  /** Custom sampler options merged with default values */
  sampler?: Partial<GPUSamplerDescriptor>;

  /** Optional label for debugging */
  label?: string;

  /** Generate mipmaps for improved quality at various distances (default: true, saves ~33% memory if false) */
  generateMipmaps?: boolean;
}

/**
 * Default sampler configuration with linear filtering and repeat addressing.
 */
export const DEFAULT_SAMPLER_OPTIONS: GPUSamplerDescriptor = {
  magFilter: "linear",
  minFilter: "linear",
  mipmapFilter: "linear",
  addressModeU: "repeat",
  addressModeV: "repeat",
};

/**
 * Predefined sampler configurations for common rendering scenarios.
 *
 * @example
 * ```ts
 * // Use pixel art preset
 * const texture = await Texture.fromURL(device, url, {
 *   sampler: SamplerPresets.PIXEL_ART,
 * });
 *
 * // Combine multiple presets
 * const texture = await Texture.fromURL(device, url, {
 *   sampler: { ...SamplerPresets.SMOOTH, ...SamplerPresets.CLAMP_EDGE },
 * });
 * ```
 */
export const SamplerPresets = {
  /** Nearest-neighbor filtering with no interpolation (ideal for pixel art) */
  PIXEL_ART: {
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  } as Partial<GPUSamplerDescriptor>,

  /** Linear filtering with interpolation for smooth appearance */
  SMOOTH: {
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  } as Partial<GPUSamplerDescriptor>,

  /** Clamp to edge addressing (prevents wrapping, useful for UI elements) */
  CLAMP_EDGE: {
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  } as Partial<GPUSamplerDescriptor>,

  /** Mirror repeat addressing (mirrors at boundaries for seamless tiling) */
  MIRROR_REPEAT: {
    addressModeU: "mirror-repeat",
    addressModeV: "mirror-repeat",
  } as Partial<GPUSamplerDescriptor>,

  /** Standard repeat addressing (default behavior) */
  REPEAT: {
    addressModeU: "repeat",
    addressModeV: "repeat",
  } as Partial<GPUSamplerDescriptor>,
} as const;

/**
 * Texture formats requiring specific GPU features for filtering support.
 */
const FEATURE_REQUIRED_FORMATS: Record<string, GPUFeatureName> = {
  rgba32float: "float32-filterable",
  rg32float: "float32-filterable",
  r32float: "float32-filterable",
};

/**
 * Texture formats supported by copyExternalImageToTexture (other formats require manual upload).
 */
const COPY_EXTERNAL_IMAGE_FORMATS: Set<GPUTextureFormat> = new Set([
  "rgba8unorm",
  "rgba8unorm-srgb",
  "bgra8unorm",
  "bgra8unorm-srgb",
]);

/**
 * WebGPU texture wrapper combining a GPUTexture and GPUSampler for rendering.
 *
 * @example
 * ```ts
 * // Load texture from URL
 * const texture = await Texture.fromURL(device, 'assets/image.png');
 *
 * // Load with custom options
 * const texture = await Texture.fromURL(device, 'assets/image.png', {
 *   srgb: true,
 *   generateMipmaps: true,
 *   sampler: SamplerPresets.PIXEL_ART,
 * });
 * ```
 */
export class Texture {
  private _gpuTexture: GPUTexture;
  private _gpuSampler: GPUSampler;
  private _width: number;
  private _height: number;
  private _format: GPUTextureFormat;
  private _mipLevelCount: number;

  /**
   * Creates a new Texture instance.
   * @param gpuTexture - The WebGPU texture object
   * @param gpuSampler - The WebGPU sampler object
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @param format - The texture format
   * @param mipLevelCount - The number of mip levels
   */
  constructor(
    gpuTexture: GPUTexture,
    gpuSampler: GPUSampler,
    width: number,
    height: number,
    format: GPUTextureFormat = "rgba8unorm",
    mipLevelCount: number = 1,
  ) {
    this._gpuTexture = gpuTexture;
    this._gpuSampler = gpuSampler;
    this._width = width;
    this._height = height;
    this._format = format;
    this._mipLevelCount = mipLevelCount;
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
   * Gets the texture width in pixels.
   */
  get width(): number {
    return this._width;
  }

  /**
   * Gets the texture height in pixels.
   */
  get height(): number {
    return this._height;
  }

  /**
   * Gets the texture format.
   */
  get format(): GPUTextureFormat {
    return this._format;
  }

  /**
   * Gets the number of mip levels (1 means no mipmaps, only base level).
   */
  get mipLevelCount(): number {
    return this._mipLevelCount;
  }

  /**
   * Checks if the texture has mipmaps.
   * @returns True if mipLevelCount > 1
   */
  get hasMipmaps(): boolean {
    return this._mipLevelCount > 1;
  }

  /**
   * Updates the texture sampler with new configuration.
   * @param device - The WebGPU device
   * @param options - Sampler options merged with defaults
   *
   * @example
   * ```ts
   * texture.updateSampler(device, SamplerPresets.PIXEL_ART);
   * texture.updateSampler(device, { addressModeU: 'clamp-to-edge' });
   * ```
   */
  updateSampler(
    device: GPUDevice,
    options: Partial<GPUSamplerDescriptor>,
  ): void {
    const mergedOptions: GPUSamplerDescriptor = {
      ...DEFAULT_SAMPLER_OPTIONS,
      ...options,
    };

    // Validate and fix options if needed
    const validatedOptions = Texture.validateSamplerOptions(mergedOptions);

    this._gpuSampler = device.createSampler(validatedOptions);
  }

  /**
   * Validates and corrects sampler options for WebGPU compatibility.
   * @param options - Sampler options to validate
   * @returns Validated sampler options with corrections applied
   */
  private static validateSamplerOptions(
    options: GPUSamplerDescriptor,
  ): GPUSamplerDescriptor {
    const result = { ...options };

    // WebGPU spec: maxAnisotropy > 1 requires all filters to be "linear"
    if (result.maxAnisotropy !== undefined && result.maxAnisotropy > 1) {
      const hasNonLinearFilter =
        result.magFilter === "nearest" ||
        result.minFilter === "nearest" ||
        result.mipmapFilter === "nearest";

      if (hasNonLinearFilter) {
        console.warn(
          `[Texture] maxAnisotropy > 1 requires all filters to be "linear". ` +
            `Resetting maxAnisotropy to 1. Current filters: ` +
            `mag=${result.magFilter}, min=${result.minFilter}, mipmap=${result.mipmapFilter}`,
        );
        result.maxAnisotropy = 1;
      }
    }

    // Validate LOD clamp range
    if (
      result.lodMinClamp !== undefined &&
      result.lodMaxClamp !== undefined &&
      result.lodMaxClamp < result.lodMinClamp
    ) {
      console.warn(
        `[Texture] lodMaxClamp (${result.lodMaxClamp}) must be >= lodMinClamp (${result.lodMinClamp}). ` +
          `Setting lodMaxClamp to lodMinClamp.`,
      );
      result.lodMaxClamp = result.lodMinClamp;
    }

    return result;
  }

  /**
   * Determines final texture format with sRGB conversion and feature validation.
   * @param device - The WebGPU device
   * @param options - Texture options containing format preferences
   * @returns Resolved texture format with fallback to 'rgba8unorm' if unsupported
   */
  private static resolveFormat(
    device: GPUDevice,
    options: TextureOptions,
  ): GPUTextureFormat {
    let format: GPUTextureFormat = options.format ?? "rgba8unorm";

    // sRGB auto-conversion
    if (options.srgb) {
      if (format === "rgba8unorm") {
        format = "rgba8unorm-srgb";
      } else if (format === "bgra8unorm") {
        format = "bgra8unorm-srgb";
      }
    }

    // Check for required features and fallback if not supported
    const requiredFeature = FEATURE_REQUIRED_FORMATS[format];
    if (requiredFeature && !device.features.has(requiredFeature)) {
      console.warn(
        `[Texture] Format '${format}' requires '${requiredFeature}' feature which is not supported. Falling back to 'rgba8unorm'.`,
      );
      return "rgba8unorm";
    }

    return format;
  }

  /**
   * Loads a texture from an image URL with automatic mipmap generation.
   * @param device - The WebGPU device
   * @param url - URL to the image file (supports standard web image formats)
   * @param options - Optional texture configuration
   * @returns Promise resolving to a loaded Texture instance
   * @throws Error if fetch fails, format is invalid, or GPU resources cannot be created
   */
  static async fromURL(
    device: GPUDevice,
    url: string,
    options: TextureOptions = {},
  ): Promise<Texture> {
    // Delegate to HDRLoader for .hdr files
    if (HDRLoader.isHDRFile(url)) {
      // Extract HDR-compatible options, ignoring format and srgb
      const { format: _format, srgb: _srgb, ...hdrOptions } = options;
      return HDRLoader.fromURL(device, url, hdrOptions);
    }

    try {
      // Load the image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch texture from ${url}: ${response.status} ${response.statusText}`,
        );
      }

      const blob = await response.blob();

      // Validate content type
      if (!blob.type.startsWith("image/")) {
        throw new Error(
          `Invalid image format from ${url}: expected image/* but got ${blob.type}`,
        );
      }

      const imageBitmap = await createImageBitmap(blob);

      // Resolve format with sRGB conversion and feature validation
      const format = Texture.resolveFormat(device, options);

      // Validate format compatibility with copyExternalImageToTexture
      if (!COPY_EXTERNAL_IMAGE_FORMATS.has(format)) {
        imageBitmap.close();
        throw new Error(
          `Format '${format}' is not compatible with fromURL(). ` +
            `Supported formats: ${[...COPY_EXTERNAL_IMAGE_FORMATS].join(", ")}. ` +
            `For other formats, use createEmpty() and upload data manually.`,
        );
      }

      // Determine whether to generate mipmaps (default: true)
      const shouldGenerateMipmaps = options.generateMipmaps !== false;

      // Check if format supports mipmap generation (must be renderable)
      let mipLevelCount = 1;
      if (shouldGenerateMipmaps) {
        if (isRenderableFormat(format)) {
          mipLevelCount = calculateMipLevelCount(
            imageBitmap.width,
            imageBitmap.height,
          );
        } else {
          console.warn(
            `[Texture] Format '${format}' does not support mipmap generation (not renderable). ` +
              `Mipmaps will be skipped. Use a renderable format like 'rgba8unorm' for mipmap support.`,
          );
        }
      }

      // Create the GPU texture
      const texture = device.createTexture({
        label: options.label ?? `Texture: ${url}`,
        size: [imageBitmap.width, imageBitmap.height, 1],
        format,
        mipLevelCount,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Upload the image data to the GPU (base mip level)
      device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [imageBitmap.width, imageBitmap.height],
      );

      // Generate mipmaps if requested and supported
      if (mipLevelCount > 1) {
        const mipmapGenerator = MipmapGenerator.get(device);
        mipmapGenerator.generateMipmap(texture);
      }

      // Merge sampler options with defaults and validate
      const mergedSamplerOptions: GPUSamplerDescriptor = {
        ...DEFAULT_SAMPLER_OPTIONS,
        ...options.sampler,
        label: options.label ? `Sampler: ${options.label}` : undefined,
      };
      const validatedSamplerOptions =
        Texture.validateSamplerOptions(mergedSamplerOptions);
      const sampler = device.createSampler(validatedSamplerOptions);

      // Release ImageBitmap resources
      imageBitmap.close();

      return new Texture(
        texture,
        sampler,
        imageBitmap.width,
        imageBitmap.height,
        format,
        mipLevelCount,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load texture from ${url}: ${error.message}`);
      }
      throw new Error(`Failed to load texture from ${url}: Unknown error`);
    }
  }

  /**
   * Destroys the GPU texture resources.
   */
  destroy(): void {
    this._gpuTexture.destroy();
  }
}
