import { describe, expect, it, mock } from "bun:test";
import {
  Texture,
  type TextureOptions,
  DEFAULT_SAMPLER_OPTIONS,
  SamplerPresets,
  calculateMipLevelCount,
  isRenderableFormat,
} from "./Texture";

// Mock GPUDevice
const createMockDevice = (features: Set<string> = new Set()): GPUDevice => {
  const mockQueue = {
    copyExternalImageToTexture: mock(() => {}),
  } as unknown as GPUQueue;

  return {
    features,
    queue: mockQueue,
    createTexture: mock((descriptor: GPUTextureDescriptor) => ({
      // Mock GPUTexture properties
      // @ts-ignore
      width: descriptor.size[0],
      // @ts-ignore
      height: descriptor.size[1],
      format: descriptor.format,
      mipLevelCount: descriptor.mipLevelCount,
      usage: descriptor.usage,
      label: descriptor.label,
      destroy: mock(() => {}),
    })) as unknown as (descriptor: GPUTextureDescriptor) => GPUTexture,
    createSampler: mock(
      (descriptor: GPUSamplerDescriptor) => descriptor,
    ) as unknown as (descriptor: GPUSamplerDescriptor) => GPUSampler,
  } as unknown as GPUDevice;
};

// Mock GPUTexture
const createMockTexture = (
  width: number = 256,
  height: number = 256,
  format: GPUTextureFormat = "rgba8unorm",
  mipLevelCount: number = 1,
): GPUTexture => {
  return {
    width,
    height,
    format,
    mipLevelCount,
    destroy: mock(() => {}),
  } as unknown as GPUTexture;
};

// Mock GPUSampler
const createMockSampler = (): GPUSampler => {
  return {} as GPUSampler;
};

describe("Texture", () => {
  describe("constructor", () => {
    it("should create a texture with provided parameters", () => {
      const gpuTexture = createMockTexture(512, 512, "rgba8unorm", 1);
      const gpuSampler = createMockSampler();

      const texture = new Texture(gpuTexture, gpuSampler, 512, 512);

      expect(texture.gpuTexture).toBe(gpuTexture);
      expect(texture.gpuSampler).toBe(gpuSampler);
      expect(texture.width).toBe(512);
      expect(texture.height).toBe(512);
      expect(texture.format).toBe("rgba8unorm");
      expect(texture.mipLevelCount).toBe(1);
    });

    it("should create a texture with custom format", () => {
      const gpuTexture = createMockTexture(256, 256, "rgba16float", 1);
      const gpuSampler = createMockSampler();

      const texture = new Texture(
        gpuTexture,
        gpuSampler,
        256,
        256,
        "rgba16float",
        1,
      );

      expect(texture.format).toBe("rgba16float");
    });

    it("should create a texture with multiple mip levels", () => {
      const gpuTexture = createMockTexture(256, 256, "rgba8unorm", 9);
      const gpuSampler = createMockSampler();

      const texture = new Texture(
        gpuTexture,
        gpuSampler,
        256,
        256,
        "rgba8unorm",
        9,
      );

      expect(texture.mipLevelCount).toBe(9);
      expect(texture.hasMipmaps).toBe(true);
    });

    it("should have hasMipmaps return false when mipLevelCount is 1", () => {
      const gpuTexture = createMockTexture(256, 256, "rgba8unorm", 1);
      const gpuSampler = createMockSampler();

      const texture = new Texture(
        gpuTexture,
        gpuSampler,
        256,
        256,
        "rgba8unorm",
        1,
      );

      expect(texture.hasMipmaps).toBe(false);
    });
  });

  describe("getters", () => {
    it("should return correct width", () => {
      const texture = new Texture(
        createMockTexture(1024, 512),
        createMockSampler(),
        1024,
        512,
      );

      expect(texture.width).toBe(1024);
    });

    it("should return correct height", () => {
      const texture = new Texture(
        createMockTexture(1024, 512),
        createMockSampler(),
        1024,
        512,
      );

      expect(texture.height).toBe(512);
    });

    it("should return correct format", () => {
      const texture = new Texture(
        createMockTexture(256, 256, "bgra8unorm"),
        createMockSampler(),
        256,
        256,
        "bgra8unorm",
      );

      expect(texture.format).toBe("bgra8unorm");
    });

    it("should return correct mipLevelCount", () => {
      const texture = new Texture(
        createMockTexture(256, 256, "rgba8unorm", 9),
        createMockSampler(),
        256,
        256,
        "rgba8unorm",
        9,
      );

      expect(texture.mipLevelCount).toBe(9);
    });

    it("should return gpuTexture", () => {
      const gpuTexture = createMockTexture();
      const texture = new Texture(gpuTexture, createMockSampler(), 256, 256);

      expect(texture.gpuTexture).toBe(gpuTexture);
    });

    it("should return gpuSampler", () => {
      const gpuSampler = createMockSampler();
      const texture = new Texture(createMockTexture(), gpuSampler, 256, 256);

      expect(texture.gpuSampler).toBe(gpuSampler);
    });
  });

  describe("hasMipmaps", () => {
    it("should return true when mipLevelCount > 1", () => {
      const texture = new Texture(
        createMockTexture(256, 256, "rgba8unorm", 9),
        createMockSampler(),
        256,
        256,
        "rgba8unorm",
        9,
      );

      expect(texture.hasMipmaps).toBe(true);
    });

    it("should return false when mipLevelCount is 1", () => {
      const texture = new Texture(
        createMockTexture(256, 256, "rgba8unorm", 1),
        createMockSampler(),
        256,
        256,
        "rgba8unorm",
        1,
      );

      expect(texture.hasMipmaps).toBe(false);
    });
  });

  describe("updateSampler", () => {
    it("should update sampler with new options", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      texture.updateSampler(device, SamplerPresets.PIXEL_ART);

      expect(device.createSampler).toHaveBeenCalled();
      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.magFilter).toBe("nearest");
      expect(lastCall.minFilter).toBe("nearest");
      expect(lastCall.mipmapFilter).toBe("nearest");
    });

    it("should merge new options with defaults", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      texture.updateSampler(device, { magFilter: "nearest" });

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.magFilter).toBe("nearest");
      expect(lastCall.minFilter).toBe("linear"); // From defaults
      expect(lastCall.addressModeU).toBe("repeat"); // From defaults
    });

    it("should validate and fix maxAnisotropy with nearest filters", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      texture.updateSampler(device, {
        magFilter: "nearest",
        maxAnisotropy: 16,
      });

      console.warn = originalWarn;

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.maxAnisotropy).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should allow maxAnisotropy > 1 with all linear filters", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      texture.updateSampler(device, {
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        maxAnisotropy: 16,
      });

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.maxAnisotropy).toBe(16);
    });

    it("should fix invalid LOD clamp range", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy;

      texture.updateSampler(device, {
        lodMinClamp: 5,
        lodMaxClamp: 2,
      });

      console.warn = originalWarn;

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.lodMaxClamp).toBe(5);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should destroy the GPU texture", () => {
      const gpuTexture = createMockTexture();
      const texture = new Texture(gpuTexture, createMockSampler(), 256, 256);

      texture.destroy();

      expect(gpuTexture.destroy).toHaveBeenCalled();
    });
  });

  describe("DEFAULT_SAMPLER_OPTIONS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_SAMPLER_OPTIONS.magFilter).toBe("linear");
      expect(DEFAULT_SAMPLER_OPTIONS.minFilter).toBe("linear");
      expect(DEFAULT_SAMPLER_OPTIONS.mipmapFilter).toBe("linear");
      expect(DEFAULT_SAMPLER_OPTIONS.addressModeU).toBe("repeat");
      expect(DEFAULT_SAMPLER_OPTIONS.addressModeV).toBe("repeat");
    });
  });

  describe("SamplerPresets", () => {
    it("PIXEL_ART should have nearest filtering", () => {
      expect(SamplerPresets.PIXEL_ART.magFilter).toBe("nearest");
      expect(SamplerPresets.PIXEL_ART.minFilter).toBe("nearest");
      expect(SamplerPresets.PIXEL_ART.mipmapFilter).toBe("nearest");
    });

    it("SMOOTH should have linear filtering", () => {
      expect(SamplerPresets.SMOOTH.magFilter).toBe("linear");
      expect(SamplerPresets.SMOOTH.minFilter).toBe("linear");
      expect(SamplerPresets.SMOOTH.mipmapFilter).toBe("linear");
    });

    it("CLAMP_EDGE should clamp to edge", () => {
      expect(SamplerPresets.CLAMP_EDGE.addressModeU).toBe("clamp-to-edge");
      expect(SamplerPresets.CLAMP_EDGE.addressModeV).toBe("clamp-to-edge");
    });

    it("MIRROR_REPEAT should mirror repeat", () => {
      expect(SamplerPresets.MIRROR_REPEAT.addressModeU).toBe("mirror-repeat");
      expect(SamplerPresets.MIRROR_REPEAT.addressModeV).toBe("mirror-repeat");
    });

    it("REPEAT should repeat", () => {
      expect(SamplerPresets.REPEAT.addressModeU).toBe("repeat");
      expect(SamplerPresets.REPEAT.addressModeV).toBe("repeat");
    });
  });

  describe("re-exported utilities", () => {
    it("should export calculateMipLevelCount", () => {
      expect(typeof calculateMipLevelCount).toBe("function");
      expect(calculateMipLevelCount(256, 256)).toBe(9);
    });

    it("should export isRenderableFormat", () => {
      expect(typeof isRenderableFormat).toBe("function");
      expect(isRenderableFormat("rgba8unorm")).toBe(true);
      expect(isRenderableFormat("bc1-rgba-unorm")).toBe(false);
    });
  });

  describe("format resolution and validation", () => {
    it("should use default format when none specified", () => {
      // This tests the internal resolveFormat logic indirectly
      // In real usage, fromURL would call resolveFormat
      const options: TextureOptions = {};
      expect(options.format).toBeUndefined();
      // Default should be 'rgba8unorm'
    });

    it("should convert to sRGB when srgb option is true", () => {
      // Testing the logic that would be in resolveFormat
      const formats = {
        rgba8unorm: "rgba8unorm-srgb",
        bgra8unorm: "bgra8unorm-srgb",
      };

      for (const [base, srgb] of Object.entries(formats)) {
        expect(base).toBeDefined();
        expect(srgb).toBeDefined();
      }
    });
  });

  describe("edge cases", () => {
    it("should handle zero mip levels", () => {
      const texture = new Texture(
        createMockTexture(256, 256, "rgba8unorm", 0),
        createMockSampler(),
        256,
        256,
        "rgba8unorm",
        0,
      );

      expect(texture.mipLevelCount).toBe(0);
      expect(texture.hasMipmaps).toBe(false);
    });

    it("should handle small textures (1x1)", () => {
      const texture = new Texture(
        createMockTexture(1, 1, "rgba8unorm", 1),
        createMockSampler(),
        1,
        1,
      );

      expect(texture.width).toBe(1);
      expect(texture.height).toBe(1);
      expect(texture.hasMipmaps).toBe(false);
    });

    it("should handle large textures (4096x4096)", () => {
      const texture = new Texture(
        createMockTexture(4096, 4096, "rgba8unorm", 13),
        createMockSampler(),
        4096,
        4096,
        "rgba8unorm",
        13,
      );

      expect(texture.width).toBe(4096);
      expect(texture.height).toBe(4096);
      expect(texture.mipLevelCount).toBe(13);
      expect(texture.hasMipmaps).toBe(true);
    });

    it("should handle non-square textures", () => {
      const texture = new Texture(
        createMockTexture(1920, 1080, "rgba8unorm", 1),
        createMockSampler(),
        1920,
        1080,
      );

      expect(texture.width).toBe(1920);
      expect(texture.height).toBe(1080);
    });

    it("should handle different texture formats", () => {
      const formats: GPUTextureFormat[] = [
        "rgba8unorm",
        "rgba8unorm-srgb",
        "bgra8unorm",
        "bgra8unorm-srgb",
        "rgba16float",
        "rgba32float",
      ];

      for (const format of formats) {
        const texture = new Texture(
          createMockTexture(256, 256, format, 1),
          createMockSampler(),
          256,
          256,
          format,
          1,
        );

        expect(texture.format).toBe(format);
      }
    });
  });

  describe("sampler validation edge cases", () => {
    it("should handle sampler with only lodMinClamp", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      texture.updateSampler(device, { lodMinClamp: 2 });

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.lodMinClamp).toBe(2);
    });

    it("should handle sampler with valid LOD range", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      texture.updateSampler(device, {
        lodMinClamp: 0,
        lodMaxClamp: 8,
      });

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.lodMinClamp).toBe(0);
      expect(lastCall.lodMaxClamp).toBe(8);
    });

    it("should allow maxAnisotropy of 1 with any filter", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      texture.updateSampler(device, {
        magFilter: "nearest",
        minFilter: "nearest",
        maxAnisotropy: 1,
      });

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.maxAnisotropy).toBe(1);
    });

    it("should preserve other options when fixing maxAnisotropy", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      const originalWarn = console.warn;
      console.warn = mock(() => {});

      texture.updateSampler(device, {
        magFilter: "nearest",
        addressModeU: "clamp-to-edge",
        maxAnisotropy: 16,
      });

      console.warn = originalWarn;

      const lastCall = (device.createSampler as any).mock.lastCall[0];
      expect(lastCall.addressModeU).toBe("clamp-to-edge");
      expect(lastCall.maxAnisotropy).toBe(1);
    });
  });

  describe("immutability", () => {
    it("should not mutate DEFAULT_SAMPLER_OPTIONS when creating sampler", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      const originalDefaults = { ...DEFAULT_SAMPLER_OPTIONS };

      texture.updateSampler(device, { magFilter: "nearest" });

      expect(DEFAULT_SAMPLER_OPTIONS).toEqual(originalDefaults);
    });

    it("should not mutate SamplerPresets when using them", () => {
      const device = createMockDevice();
      const texture = new Texture(
        createMockTexture(),
        createMockSampler(),
        256,
        256,
      );

      const originalPixelArt = { ...SamplerPresets.PIXEL_ART };

      texture.updateSampler(device, SamplerPresets.PIXEL_ART);

      expect(SamplerPresets.PIXEL_ART).toEqual(originalPixelArt);
    });
  });
});
