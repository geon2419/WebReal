import { describe, it, expect, mock, beforeAll } from "bun:test";
import { FallbackResources } from "./FallbackResources";

// Mock WebGPU globals
beforeAll(() => {
  (globalThis as any).GPUTextureUsage = {
    TEXTURE_BINDING: 4,
  };
});

describe("FallbackResources", () => {
  function createMockDevice() {
    return {
      createTexture: mock(() => ({
        destroy: mock(() => {}),
      })),
    } as unknown as GPUDevice;
  }

  describe("getDummyCubeTexture", () => {
    it("should lazily create cube texture on first call", () => {
      const device = createMockDevice();
      const resources = new FallbackResources(device);

      resources.getDummyCubeTexture();

      expect(device.createTexture).toHaveBeenCalledTimes(1);
    });

    it("should reuse same texture on subsequent calls", () => {
      const device = createMockDevice();
      const resources = new FallbackResources(device);

      const texture1 = resources.getDummyCubeTexture();
      const texture2 = resources.getDummyCubeTexture();

      expect(texture1).toBe(texture2);
      expect(device.createTexture).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDummyBrdfLUT", () => {
    it("should lazily create BRDF LUT on first call", () => {
      const device = createMockDevice();
      const resources = new FallbackResources(device);

      resources.getDummyBrdfLUT();

      expect(device.createTexture).toHaveBeenCalledTimes(1);
    });

    it("should reuse same texture on subsequent calls", () => {
      const device = createMockDevice();
      const resources = new FallbackResources(device);

      const texture1 = resources.getDummyBrdfLUT();
      const texture2 = resources.getDummyBrdfLUT();

      expect(texture1).toBe(texture2);
      expect(device.createTexture).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispose", () => {
    it("should destroy created textures", () => {
      const device = createMockDevice();
      const resources = new FallbackResources(device);

      const cubeTexture = resources.getDummyCubeTexture();
      const brdfLUT = resources.getDummyBrdfLUT();

      resources.dispose();

      expect(cubeTexture.destroy).toHaveBeenCalledTimes(1);
      expect(brdfLUT.destroy).toHaveBeenCalledTimes(1);
    });

    it("should allow re-creation after disposal", () => {
      const device = createMockDevice();
      const resources = new FallbackResources(device);

      const texture1 = resources.getDummyCubeTexture();
      resources.dispose();
      const texture2 = resources.getDummyCubeTexture();

      expect(texture1).not.toBe(texture2);
      expect(device.createTexture).toHaveBeenCalledTimes(2);
    });

    it("should not throw when disposing without creating textures", () => {
      const device = createMockDevice();
      const resources = new FallbackResources(device);

      expect(() => resources.dispose()).not.toThrow();
    });
  });
});
