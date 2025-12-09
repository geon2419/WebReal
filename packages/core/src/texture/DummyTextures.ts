import { Texture, DEFAULT_SAMPLER_OPTIONS } from "./Texture";

/**
 * Utility class for creating and caching dummy textures.
 * Dummy textures are 1x1 pixel textures used as fallbacks when
 * optional texture slots are not provided.
 */
export class DummyTextures {
  private static _blackTexture: Texture | null = null;
  private static _whiteTexture: Texture | null = null;
  private static _normalTexture: Texture | null = null;

  /**
   * Gets a cached 1x1 black texture (RGBA: 0, 0, 0, 255).
   * Useful as default for displacement maps where black = no displacement.
   * @param device - WebGPU device
   * @returns Cached black texture
   */
  static getBlack(device: GPUDevice): Texture {
    if (!this._blackTexture) {
      this._blackTexture = this.create1x1Texture(
        device,
        new Uint8Array([0, 0, 0, 255]),
        "DummyTexture:Black"
      );
    }
    return this._blackTexture;
  }

  /**
   * Gets a cached 1x1 white texture (RGBA: 255, 255, 255, 255).
   * Useful as default for albedo, AO maps where white = full value.
   * @param device - WebGPU device
   * @returns Cached white texture
   */
  static getWhite(device: GPUDevice): Texture {
    if (!this._whiteTexture) {
      this._whiteTexture = this.create1x1Texture(
        device,
        new Uint8Array([255, 255, 255, 255]),
        "DummyTexture:White"
      );
    }
    return this._whiteTexture;
  }

  /**
   * Gets a cached 1x1 default normal texture (RGBA: 128, 128, 255, 255).
   * Represents an up-facing normal (0, 0, 1) in tangent space.
   * @param device - WebGPU device
   * @returns Cached normal texture
   */
  static getNormal(device: GPUDevice): Texture {
    if (!this._normalTexture) {
      this._normalTexture = this.create1x1Texture(
        device,
        new Uint8Array([128, 128, 255, 255]),
        "DummyTexture:Normal"
      );
    }
    return this._normalTexture;
  }

  /**
   * Creates a 1x1 texture with the specified pixel data.
   * @param device - WebGPU device
   * @param data - RGBA pixel data (4 bytes)
   * @param label - Debug label for the texture
   * @returns New Texture instance
   */
  private static create1x1Texture(
    device: GPUDevice,
    data: Uint8Array,
    label: string
  ): Texture {
    const gpuTexture = device.createTexture({
      label,
      size: [1, 1, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.writeTexture(
      { texture: gpuTexture },
      data.buffer,
      { bytesPerRow: 4 },
      [1, 1, 1]
    );

    const gpuSampler = device.createSampler({
      ...DEFAULT_SAMPLER_OPTIONS,
      label: `Sampler:${label}`,
    });

    return new Texture(gpuTexture, gpuSampler, 1, 1, "rgba8unorm", 1);
  }

  /**
   * Clears all cached textures. Call this when the device is lost or destroyed.
   */
  static clearCache(): void {
    if (this._blackTexture) {
      this._blackTexture.destroy();
      this._blackTexture = null;
    }
    if (this._whiteTexture) {
      this._whiteTexture.destroy();
      this._whiteTexture = null;
    }
    if (this._normalTexture) {
      this._normalTexture.destroy();
      this._normalTexture = null;
    }
  }
}
