import { SamplerCache } from "../texture/SamplerCache";

/**
 * Provides lazily-created fallback GPU resources used when optional textures are missing.
 *
 * @example
 * ```ts
 * const resources = new FallbackResources(device);
 * const cube = resources.getDummyCubeTexture();
 * const sampler = resources.getLinearSampler();
 * // ...use cube + sampler in bind groups...
 * resources.dispose();
 * ```
 */
export class FallbackResources {
  private _device: GPUDevice;
  private _dummyCubeTexture?: GPUTexture;
  private _dummyBrdfLUT?: GPUTexture;
  private _samplerCache: SamplerCache = new SamplerCache();

  /**
   * Creates a new fallback resource container for a specific GPU device.
   * @param device - The GPU device used to create textures and samplers
   */
  constructor(device: GPUDevice) {
    this._device = device;
  }

  /**
   * Returns a 1×1×6 dummy cube texture for IBL/environment bindings.
   * @returns A GPUTexture that can be bound as a cube texture fallback
   */
  public getDummyCubeTexture(): GPUTexture {
    if (!this._dummyCubeTexture) {
      this._dummyCubeTexture = this._device.createTexture({
        label: "Dummy IBL Cube Texture",
        size: [1, 1, 6],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING,
        dimension: "2d",
      });
    }

    return this._dummyCubeTexture;
  }

  /**
   * Returns a 1×1 dummy BRDF LUT texture for PBR pipelines.
   * @returns A GPUTexture that can be bound as a BRDF LUT fallback
   */
  public getDummyBrdfLUT(): GPUTexture {
    if (!this._dummyBrdfLUT) {
      this._dummyBrdfLUT = this._device.createTexture({
        label: "Dummy BRDF LUT",
        size: [1, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING,
        dimension: "2d",
      });
    }

    return this._dummyBrdfLUT;
  }

  /**
   * Returns a reusable linear-filter sampler from the internal sampler cache.
   * @returns A GPUSampler configured with linear min/mag filtering
   */
  public getLinearSampler(): GPUSampler {
    return this._samplerCache.get(this._device, {
      magFilter: "linear",
      minFilter: "linear",
    });
  }

  /**
   * Destroys any created fallback textures and releases references.
   */
  public dispose(): void {
    this._dummyCubeTexture?.destroy();
    this._dummyCubeTexture = undefined;

    this._dummyBrdfLUT?.destroy();
    this._dummyBrdfLUT = undefined;
  }
}
