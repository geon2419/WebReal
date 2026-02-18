/**
 * HDR texture loader for Radiance HDR (.hdr) files.
 *
 * Loads HDR environment maps and converts them to WebGPU textures
 * with float16 or float32 format for use with IBL/PBR rendering.
 *
 * @module HDRLoader
 */

import {
  Texture,
  DEFAULT_SAMPLER_OPTIONS,
  type TextureOptions,
} from "./Texture";
import {
  MipmapGenerator,
  calculateMipLevelCount,
  isRenderableFormat,
} from "./MipmapGenerator";
import {
  parse as parseRGBE,
  type RGBEResult,
  RGBEParserError,
} from "./RGBEParser";
import { toFloat16Array } from "./Float16";

const BYTES_PER_CHANNEL_F16 = 2;
const BYTES_PER_CHANNEL_F32 = 4;
const RGBA_CHANNELS = 4;
const BYTES_PER_PIXEL_F16 = RGBA_CHANNELS * BYTES_PER_CHANNEL_F16; // 8 bytes
const BYTES_PER_PIXEL_F32 = RGBA_CHANNELS * BYTES_PER_CHANNEL_F32; // 16 bytes

export type HDRFormat = "rgba16float" | "rgba32float";

export interface HDRLoaderOptions extends Omit<
  TextureOptions,
  "format" | "srgb"
> {
  format?: HDRFormat;
  applyExposure?: boolean;
}

/**
 * Error thrown when HDR loading or parsing fails.
 */
export class HDRLoaderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "HDRLoaderError";
  }
}

/**
 * Loads Radiance HDR (.hdr) files and converts them to WebGPU textures for PBR/IBL rendering.
 *
 * @example
 * ```ts
 * const hdrTexture = await HDRLoader.fromURL(device, 'environment.hdr');
 * const hdrTexture = await HDRLoader.fromURL(device, 'env.hdr', {
 *   format: 'rgba32float',
 *   generateMipmaps: true,
 * });
 * ```
 */
export class HDRLoader {
  /**
   * Loads an HDR texture from a URL.
   * @param device - WebGPU device
   * @param url - URL to the .hdr file
   * @param options - Loading and texture options
   * @returns Promise resolving to a Texture instance
   * @throws {HDRLoaderError} If loading or parsing fails
   */
  static async fromURL(
    device: GPUDevice,
    url: string,
    options: HDRLoaderOptions = {},
  ): Promise<Texture> {
    if (!device) {
      throw new HDRLoaderError("GPU device is required");
    }
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      throw new HDRLoaderError("Valid URL string is required");
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new HDRLoaderError(
          `Failed to fetch HDR from ${url}: ${response.status} ${response.statusText}`,
        );
      }

      const buffer = await response.arrayBuffer();
      return this.fromBuffer(device, buffer, {
        ...options,
        label: options.label ?? url,
      });
    } catch (error) {
      if (error instanceof HDRLoaderError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new HDRLoaderError(
          `Network error while fetching HDR from ${url}: ${error.message}`,
          error,
        );
      }

      throw new HDRLoaderError(
        `Unexpected error loading HDR from ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error,
      );
    }
  }

  /**
   * Loads an HDR texture from an ArrayBuffer.
   * @param device - WebGPU device
   * @param buffer - HDR file data as ArrayBuffer
   * @param options - Loading and texture options
   * @returns Promise resolving to a Texture instance
   * @throws {HDRLoaderError} If parsing fails
   */
  static async fromBuffer(
    device: GPUDevice,
    buffer: ArrayBuffer,
    options: HDRLoaderOptions = {},
  ): Promise<Texture> {
    this.validateInputs(device, buffer);
    const parsed = this.parseHDRBuffer(buffer);
    const { width, height, data, exposure } = parsed;

    if (width <= 0 || height <= 0) {
      throw new HDRLoaderError(
        `Invalid texture dimensions: ${width}x${height}`,
      );
    }

    const format = options.format ?? "rgba16float";
    this.validateGPUFeatures(device, format);

    const shouldGenerateMipmaps = options.generateMipmaps !== false;

    let gpuTexture: GPUTexture | null = null;

    try {
      const { uploadData, bytesPerPixel } = this.processHDRData(
        data,
        exposure,
        format,
        options.applyExposure,
      );

      const mipLevelCount =
        shouldGenerateMipmaps && isRenderableFormat(format)
          ? calculateMipLevelCount(width, height)
          : 1;

      // Create GPU texture
      gpuTexture = device.createTexture({
        label: options.label ?? "HDRTexture",
        size: [width, height, 1],
        format: format as GPUTextureFormat,
        mipLevelCount,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Upload texture data
      device.queue.writeTexture(
        { texture: gpuTexture },
        uploadData.buffer,
        {
          bytesPerRow: width * bytesPerPixel,
          rowsPerImage: height,
        },
        [width, height, 1],
      );

      // Generate mipmaps if requested
      if (mipLevelCount > 1) {
        const mipmapGenerator = MipmapGenerator.get(device);
        mipmapGenerator.generateMipmap(gpuTexture);
      }

      const gpuSampler = this.createSampler(device, options);

      return new Texture(
        gpuTexture,
        gpuSampler,
        width,
        height,
        format,
        mipLevelCount,
      );
    } catch (error) {
      if (gpuTexture) {
        gpuTexture.destroy();
      }

      if (error instanceof HDRLoaderError) {
        throw error;
      }

      throw new HDRLoaderError(
        `Failed to create HDR texture: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Validates input parameters for HDR loading.
   * @param device - WebGPU device
   * @param buffer - HDR file data as ArrayBuffer
   * @throws {HDRLoaderError} If device or buffer is invalid
   */
  private static validateInputs(device: GPUDevice, buffer: ArrayBuffer): void {
    if (!device) {
      throw new HDRLoaderError("GPU device is required");
    }

    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      throw new HDRLoaderError("Valid ArrayBuffer is required");
    }

    if (buffer.byteLength === 0) {
      throw new HDRLoaderError("ArrayBuffer cannot be empty");
    }
  }

  /**
   * Parses HDR buffer data using RGBE format.
   * @param buffer - HDR file data as ArrayBuffer
   * @returns Parsed HDR data with dimensions, pixel data, and exposure
   * @throws {HDRLoaderError} If parsing fails or format is invalid
   */
  private static parseHDRBuffer(buffer: ArrayBuffer): RGBEResult {
    try {
      return parseRGBE(buffer);
    } catch (error) {
      if (error instanceof RGBEParserError) {
        throw new HDRLoaderError(
          `Invalid HDR file format: ${error.message}`,
          error,
        );
      }

      throw new HDRLoaderError(
        `Failed to parse HDR data: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  /**
   * Validates GPU features for the requested texture format.
   * @param device - WebGPU device
   * @param format - Requested HDR texture format
   * @throws {HDRLoaderError} If required GPU features are not supported
   */
  private static validateGPUFeatures(
    device: GPUDevice,
    format: HDRFormat,
  ): void {
    if (
      format === "rgba32float" &&
      !device.features.has("float32-filterable")
    ) {
      throw new HDRLoaderError(
        "Device does not support 'float32-filterable' feature required for rgba32float format. " +
          "Use 'rgba16float' format instead or ensure the GPU supports this feature.",
      );
    }
  }

  /**
   * Processes HDR data by applying exposure correction and format conversion.
   * @param data - Raw HDR pixel data in RGBA format
   * @param exposure - Exposure value from HDR file header
   * @param format - Target texture format (rgba16float or rgba32float)
   * @param applyExposure - Whether to apply exposure correction (default: true)
   * @returns Processed pixel data and bytes per pixel for upload
   */
  private static processHDRData(
    data: Float32Array,
    exposure: number,
    format: HDRFormat,
    applyExposure?: boolean,
  ): { uploadData: Uint16Array | Float32Array; bytesPerPixel: number } {
    const shouldApplyExposure = applyExposure !== false;

    let processedData = data;
    if (shouldApplyExposure && exposure !== 1.0) {
      processedData = new Float32Array(data.length);
      for (let i = 0; i < data.length; i += 4) {
        processedData[i] = data[i] * exposure; // R
        processedData[i + 1] = data[i + 1] * exposure; // G
        processedData[i + 2] = data[i + 2] * exposure; // B
        processedData[i + 3] = data[i + 3]; // A (unchanged)
      }
    }

    if (format === "rgba16float") {
      return {
        uploadData: toFloat16Array(processedData),
        bytesPerPixel: BYTES_PER_PIXEL_F16,
      };
    } else {
      return {
        uploadData: processedData,
        bytesPerPixel: BYTES_PER_PIXEL_F32,
      };
    }
  }

  /**
   * Creates a GPU sampler with HDR-appropriate settings.
   * @param device - WebGPU device
   * @param options - Loader options containing sampler configuration
   * @returns GPU sampler with clamp-to-edge address mode
   */
  private static createSampler(
    device: GPUDevice,
    options: HDRLoaderOptions,
  ): GPUSampler {
    const samplerOptions: GPUSamplerDescriptor = {
      ...DEFAULT_SAMPLER_OPTIONS,
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      ...options.sampler,
      label: options.label ? `Sampler: ${options.label}` : undefined,
    };
    return device.createSampler(samplerOptions);
  }

  /**
   * Checks if a URL points to an HDR file based on extension.
   * @param url - The URL to check
   * @returns True if the URL has an .hdr extension
   */
  static isHDRFile(url: string): boolean {
    if (!url || typeof url !== "string") {
      return false;
    }
    const cleanUrl = url.split("?")[0].split("#")[0]; // Remove query/hash
    return cleanUrl.toLowerCase().endsWith(".hdr");
  }
}
