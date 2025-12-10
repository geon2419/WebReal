import { describe, expect, it, mock, beforeEach } from "bun:test";
import { HDRLoader, HDRLoaderError } from "./HDRLoader";
import { Texture } from "./Texture";

// Mock WebGPU constants
globalThis.GPUTextureUsage = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
} as GPUTextureUsage;

// Mock GPUDevice
const createMockDevice = (features: Set<string> = new Set()): GPUDevice => {
  const mockQueue = {
    writeTexture: mock(() => {}),
  } as unknown as GPUQueue;

  return {
    features,
    queue: mockQueue,
    createTexture: mock((descriptor: GPUTextureDescriptor) => {
      const size = Array.isArray(descriptor.size)
        ? descriptor.size
        : [
            // @ts-ignore
            descriptor.size.width,
            // @ts-ignore
            descriptor.size.height,
            // @ts-ignore
            descriptor.size.depthOrArrayLayers ?? 1,
          ];
      return {
        width: size[0],
        height: size[1],
        format: descriptor.format,
        mipLevelCount: descriptor.mipLevelCount,
        usage: descriptor.usage,
        label: descriptor.label,
        destroy: mock(() => {}),
      };
    }) as unknown as (descriptor: GPUTextureDescriptor) => GPUTexture,
    createSampler: mock(
      (descriptor: GPUSamplerDescriptor) => descriptor
    ) as unknown as (descriptor: GPUSamplerDescriptor) => GPUSampler,
  } as unknown as GPUDevice;
};

// Helper to create a minimal valid RGBE file buffer
const createMockRGBEBuffer = (
  width: number = 2,
  height: number = 2
): ArrayBuffer => {
  // Simple RGBE header
  const header = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`;
  const headerBytes = new TextEncoder().encode(header);

  // RGBE pixel data (4 bytes per pixel: R, G, B, E)
  const pixelCount = width * height;
  const pixelData = new Uint8Array(pixelCount * 4);

  // Fill with simple test data (gray pixels)
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    pixelData[offset] = 128; // R
    pixelData[offset + 1] = 128; // G
    pixelData[offset + 2] = 128; // B
    pixelData[offset + 3] = 128; // E (exponent = 128, giving scale 2^-8, so RGB 128 -> 0.5)
  }

  // Combine header and pixel data
  const buffer = new Uint8Array(headerBytes.length + pixelData.length);
  buffer.set(headerBytes, 0);
  buffer.set(pixelData, headerBytes.length);

  return buffer.buffer;
};

describe("HDRLoader", () => {
  describe("fromBuffer", () => {
    it("should load HDR from valid buffer", async () => {
      const device = createMockDevice();
      const buffer = createMockRGBEBuffer(4, 8);

      const texture = await HDRLoader.fromBuffer(device, buffer, {
        generateMipmaps: false,
      });

      expect(texture).toBeInstanceOf(Texture);
      expect(texture.width).toBe(4);
      expect(texture.height).toBe(8);
      expect(texture.format).toBe("rgba16float");
    });

    it("should throw error for invalid input", async () => {
      const device = createMockDevice();

      await expect(
        HDRLoader.fromBuffer(null as unknown as GPUDevice, new ArrayBuffer(0))
      ).rejects.toThrow(HDRLoaderError);

      await expect(
        HDRLoader.fromBuffer(device, new ArrayBuffer(0))
      ).rejects.toThrow("ArrayBuffer cannot be empty");
    });

    it("should support rgba32float format", async () => {
      const device = createMockDevice(new Set(["float32-filterable"]));
      const buffer = createMockRGBEBuffer(2, 2);

      const texture = await HDRLoader.fromBuffer(device, buffer, {
        format: "rgba32float",
        generateMipmaps: false,
      });

      expect(texture.format).toBe("rgba32float");
    });
  });

  describe("fromURL", () => {
    beforeEach(() => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(createMockRGBEBuffer(2, 2)),
        })
      ) as unknown as typeof fetch;
    });

    it("should load HDR from URL", async () => {
      const device = createMockDevice();

      const texture = await HDRLoader.fromURL(
        device,
        "http://example.com/test.hdr",
        { generateMipmaps: false }
      );

      expect(texture).toBeInstanceOf(Texture);
      expect(texture.width).toBe(2);
      expect(texture.height).toBe(2);
    });

    it("should handle fetch errors", async () => {
      const device = createMockDevice();
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        })
      ) as unknown as typeof fetch;

      await expect(
        HDRLoader.fromURL(device, "http://example.com/missing.hdr")
      ).rejects.toThrow("404 Not Found");
    });
  });

  describe("isHDRFile", () => {
    it("should identify HDR files correctly", () => {
      expect(HDRLoader.isHDRFile("environment.hdr")).toBe(true);
      expect(HDRLoader.isHDRFile("environment.HDR")).toBe(true);
      expect(HDRLoader.isHDRFile("file.hdr?version=1")).toBe(true);
      expect(HDRLoader.isHDRFile("image.png")).toBe(false);
      expect(HDRLoader.isHDRFile("")).toBe(false);
    });
  });
});
