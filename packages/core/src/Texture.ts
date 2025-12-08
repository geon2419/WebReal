/**
 * Options for creating a texture.
 */
export interface TextureOptions {
  /**
   * The texture format. Defaults to 'rgba8unorm'.
   *
   * **Note:** When using `fromURL()`, only formats compatible with
   * `copyExternalImageToTexture` are supported:
   * - 'rgba8unorm' - Standard color texture
   * - 'rgba8unorm-srgb' - Color texture with automatic gamma correction
   * - 'bgra8unorm' - Alternative byte order (platform-dependent)
   * - 'bgra8unorm-srgb' - Alternative byte order with gamma correction
   *
   * For other formats (HDR, normal maps, etc.), use `createEmpty()` and
   * upload data manually via compute shader or staging buffer.
   */
  format?: GPUTextureFormat;

  /**
   * If true, automatically converts format to sRGB variant for gamma correction.
   * Applies to:
   * - 'rgba8unorm' -> 'rgba8unorm-srgb'
   * - 'bgra8unorm' -> 'bgra8unorm-srgb'
   * Defaults to false.
   */
  srgb?: boolean;

  /**
   * Custom sampler options. Merged with default values.
   */
  sampler?: Partial<GPUSamplerDescriptor>;

  /**
   * Optional label for debugging.
   */
  label?: string;
}

/**
 * Default sampler configuration.
 */
export const DEFAULT_SAMPLER_OPTIONS: GPUSamplerDescriptor = {
  magFilter: "linear",
  minFilter: "linear",
  mipmapFilter: "linear",
  addressModeU: "repeat",
  addressModeV: "repeat",
};

/**
 * Predefined sampler presets for common use cases.
 *
 * @example
 * ```typescript
 * // Pixel art style (no interpolation)
 * const texture = await Texture.fromURL(device, url, {
 *   sampler: SamplerPresets.PIXEL_ART,
 * });
 *
 * // Combine presets with spread operator
 * const texture = await Texture.fromURL(device, url, {
 *   sampler: { ...SamplerPresets.SMOOTH, ...SamplerPresets.CLAMP_EDGE },
 * });
 * ```
 */
export const SamplerPresets = {
  /**
   * Nearest-neighbor filtering for pixel art style.
   * No interpolation between texels.
   */
  PIXEL_ART: {
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  } as Partial<GPUSamplerDescriptor>,

  /**
   * Linear filtering for smooth textures.
   * Interpolates between texels for smoother appearance.
   */
  SMOOTH: {
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  } as Partial<GPUSamplerDescriptor>,

  /**
   * Clamp to edge address mode.
   * Prevents texture wrapping, useful for UI elements or single images.
   */
  CLAMP_EDGE: {
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  } as Partial<GPUSamplerDescriptor>,

  /**
   * Mirror repeat address mode.
   * Texture mirrors at boundaries for seamless tiling.
   */
  MIRROR_REPEAT: {
    addressModeU: "mirror-repeat",
    addressModeV: "mirror-repeat",
  } as Partial<GPUSamplerDescriptor>,

  /**
   * Standard repeat address mode.
   * Texture repeats at boundaries (default behavior).
   */
  REPEAT: {
    addressModeU: "repeat",
    addressModeV: "repeat",
  } as Partial<GPUSamplerDescriptor>,
} as const;

/**
 * Formats that require specific device features for filtering.
 */
const FEATURE_REQUIRED_FORMATS: Record<string, GPUFeatureName> = {
  rgba32float: "float32-filterable",
  rg32float: "float32-filterable",
  r32float: "float32-filterable",
};

/**
 * Formats compatible with copyExternalImageToTexture.
 * Other formats require manual data upload.
 */
const COPY_EXTERNAL_IMAGE_FORMATS: Set<GPUTextureFormat> = new Set([
  "rgba8unorm",
  "rgba8unorm-srgb",
  "bgra8unorm",
  "bgra8unorm-srgb",
]);

/**
 * Represents a texture that can be used for rendering.
 * Wraps a GPUTexture and GPUSampler for WebGPU usage.
 */
export class Texture {
  private _gpuTexture: GPUTexture;
  private _gpuSampler: GPUSampler;
  private _width: number;
  private _height: number;
  private _format: GPUTextureFormat;

  /**
   * Creates a new Texture instance.
   * @param gpuTexture - The WebGPU texture object
   * @param gpuSampler - The WebGPU sampler object
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @param format - The texture format
   */
  constructor(
    gpuTexture: GPUTexture,
    gpuSampler: GPUSampler,
    width: number,
    height: number,
    format: GPUTextureFormat = "rgba8unorm"
  ) {
    this._gpuTexture = gpuTexture;
    this._gpuSampler = gpuSampler;
    this._width = width;
    this._height = height;
    this._format = format;
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
   * Updates the sampler with new options.
   * Creates a new GPUSampler and replaces the existing one.
   *
   * @param device - The WebGPU device
   * @param options - Sampler options to merge with defaults
   *
   * @example
   * ```typescript
   * // Change to pixel art style filtering
   * texture.updateSampler(device, SamplerPresets.PIXEL_ART);
   *
   * // Change address mode to clamp
   * texture.updateSampler(device, { addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
   * ```
   */
  updateSampler(
    device: GPUDevice,
    options: Partial<GPUSamplerDescriptor>
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
   * Validates sampler options and fixes invalid configurations.
   * WebGPU requires all filters to be "linear" when maxAnisotropy > 1.
   *
   * @param options - The sampler options to validate
   * @returns Validated and potentially corrected sampler options
   */
  private static validateSamplerOptions(
    options: GPUSamplerDescriptor
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
            `mag=${result.magFilter}, min=${result.minFilter}, mipmap=${result.mipmapFilter}`
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
          `Setting lodMaxClamp to lodMinClamp.`
      );
      result.lodMaxClamp = result.lodMinClamp;
    }

    return result;
  }

  /**
   * Resolves the final texture format based on options.
   * Handles sRGB conversion and feature validation with fallback.
   */
  private static resolveFormat(
    device: GPUDevice,
    options: TextureOptions
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
        `[Texture] Format '${format}' requires '${requiredFeature}' feature which is not supported. Falling back to 'rgba8unorm'.`
      );
      return "rgba8unorm";
    }

    return format;
  }

  /**
   * Loads a texture from a URL.
   *
   * **Supported formats:** Only 8-bit unorm formats compatible with
   * `copyExternalImageToTexture` are supported: `rgba8unorm`, `rgba8unorm-srgb`,
   * `bgra8unorm`, `bgra8unorm-srgb`. For other formats, use `createEmpty()`.
   *
   * @param device - The WebGPU device
   * @param url - URL to the image file
   * @param options - Optional texture configuration
   * @returns A promise that resolves to a Texture instance
   * @throws {Error} If the network request fails, image format is invalid, format is unsupported, or GPU resources cannot be created
   */
  static async fromURL(
    device: GPUDevice,
    url: string,
    options: TextureOptions = {}
  ): Promise<Texture> {
    try {
      // Load the image
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch texture from ${url}: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();

      // Validate content type
      if (!blob.type.startsWith("image/")) {
        throw new Error(
          `Invalid image format from ${url}: expected image/* but got ${blob.type}`
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
            `Supported formats: ${[...COPY_EXTERNAL_IMAGE_FORMATS].join(
              ", "
            )}. ` +
            `For other formats, use createEmpty() and upload data manually.`
        );
      }

      // Create the GPU texture
      const texture = device.createTexture({
        label: options.label ?? `Texture: ${url}`,
        size: [imageBitmap.width, imageBitmap.height, 1],
        format,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Upload the image data to the GPU
      device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [imageBitmap.width, imageBitmap.height]
      );

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
        format
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
