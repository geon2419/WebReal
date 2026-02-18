import { Texture, DEFAULT_SAMPLER_OPTIONS } from "./Texture";
import brdfLutShader from "../shaders/brdf-lut.wgsl?raw";

export class BRDFLutError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BRDFLutError";
  }
}

/**
 * Pre-computed BRDF integration LUT for PBR IBL rendering.
 * Uses split-sum approximation indexed by NdotV (U) and roughness (V).
 *
 * @example
 * ```ts
 * const brdfLUT = BRDFLut.get(device);
 * const brdfLUT = await BRDFLut.getAsync(device);
 * ```
 */
export class BRDFLut {
  /** Shared BRDF LUT cache per device */
  private static _cache = new WeakMap<GPUDevice, Texture>();
  /** Pending generation promises per device (for async deduplication) */
  private static _pendingGenerations = new WeakMap<
    GPUDevice,
    Promise<Texture>
  >();
  /** BRDF LUT resolution (512x512 provides good quality) */
  static readonly SIZE = 512;
  /** BRDF LUT format (RG16 is sufficient for scale/bias values) */
  static readonly FORMAT: GPUTextureFormat = "rg16float";

  /**
   * Validates that the device is ready for use.
   *
   * @param device - The WebGPU device to validate
   * @throws {BRDFLutError} If device is invalid
   */
  private static _validateDevice(device: GPUDevice): void {
    if (!device) {
      throw new BRDFLutError("GPUDevice is required but was not provided");
    }
  }

  /**
   * Gets the shared BRDF LUT texture, creating it on first call.
   * @param device - The WebGPU device
   * @returns The BRDF LUT texture (GPU work may not be complete)
   */
  static get(device: GPUDevice): Texture {
    this._validateDevice(device);

    let lut = this._cache.get(device);
    if (!lut) {
      lut = this._generate(device);
      this._cache.set(device, lut);
    }
    return lut;
  }

  /**
   * Gets the shared BRDF LUT texture asynchronously, waiting for GPU completion.
   * @param device - The WebGPU device
   * @returns Promise resolving to the BRDF LUT texture
   */
  static async getAsync(device: GPUDevice): Promise<Texture> {
    this._validateDevice(device);

    // Return cached texture if available
    const cached = this._cache.get(device);
    if (cached) {
      return cached;
    }

    // Check if generation is already in progress (deduplication)
    const pending = this._pendingGenerations.get(device);
    if (pending) {
      return pending;
    }

    // Start new generation
    const generationPromise = this._generateAsync(device);
    this._pendingGenerations.set(device, generationPromise);

    try {
      const lut = await generationPromise;
      this._cache.set(device, lut);
      return lut;
    } finally {
      this._pendingGenerations.delete(device);
    }
  }

  /**
   * Clears the cached BRDF LUT for a device.
   * @param device - The WebGPU device
   */
  static clearCache(device: GPUDevice): void {
    const lut = this._cache.get(device);
    if (lut) {
      lut.destroy();
      this._cache.delete(device);
    }

    this._pendingGenerations.delete(device);
  }

  /**
   * Generates the BRDF LUT using a render pass (async version).
   * @param device - The WebGPU device
   * @returns Promise resolving to the generated BRDF LUT texture
   * @throws {BRDFLutError} If generation fails
   */
  private static async _generateAsync(device: GPUDevice): Promise<Texture> {
    const texture = this._generate(device);

    try {
      // Wait for GPU work to complete
      await device.queue.onSubmittedWorkDone();
      return texture;
    } catch (error) {
      texture.destroy();
      throw new BRDFLutError("Failed to complete BRDF LUT generation", error);
    }
  }

  /**
   * Generates the BRDF LUT using a render pass.
   * @param device - The WebGPU device
   * @returns The generated BRDF LUT texture
   * @throws {BRDFLutError} If generation fails
   */
  private static _generate(device: GPUDevice): Texture {
    const size = this.SIZE;
    const format = this.FORMAT;

    let gpuTexture: GPUTexture | null = null;
    let shaderModule: GPUShaderModule | null = null;

    try {
      // Create the output texture
      gpuTexture = device.createTexture({
        label: "BRDFLut",
        size: [size, size, 1],
        format,
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Create sampler with clamp-to-edge (important for LUT edges)
      const gpuSampler = device.createSampler({
        ...DEFAULT_SAMPLER_OPTIONS,
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        label: "BRDFLut:Sampler",
      });

      // Create shader module
      shaderModule = device.createShaderModule({
        label: "BRDFLut:Shader",
        code: brdfLutShader,
      });

      // Create render pipeline
      const pipeline = device.createRenderPipeline({
        label: "BRDFLut:Pipeline",
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vertexMain",
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fragmentMain",
          targets: [{ format }],
        },
        primitive: {
          topology: "triangle-list",
        },
      });

      // Create texture view for rendering
      const textureView = gpuTexture.createView();

      // Execute render pass
      const commandEncoder = device.createCommandEncoder({
        label: "BRDFLut:CommandEncoder",
      });

      const renderPass = commandEncoder.beginRenderPass({
        label: "BRDFLut:RenderPass",
        colorAttachments: [
          {
            view: textureView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          },
        ],
      });

      renderPass.setPipeline(pipeline);
      renderPass.draw(3); // Fullscreen triangle
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);

      return new Texture(gpuTexture, gpuSampler, size, size, format, 1);
    } catch (error) {
      if (gpuTexture) {
        gpuTexture.destroy();
      }

      throw new BRDFLutError(
        "Failed to generate BRDF LUT. This may indicate a WebGPU device issue.",
        error,
      );
    }
  }
}
