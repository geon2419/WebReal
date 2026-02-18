import { describe, it, expect } from "bun:test";
import { parse, RGBEParserError } from "./RGBEParser";

/**
 * Creates a minimal valid RGBE file buffer for testing.
 */
function createRGBEBuffer(options: {
  width: number;
  height: number;
  pixels?: number[][]; // RGBE values [r, g, b, e]
  useRLE?: boolean;
  exposure?: number;
  gamma?: number;
}): ArrayBuffer {
  const { width, height, pixels, useRLE = false, exposure, gamma } = options;

  const lines: string[] = [];

  // Header
  lines.push("#?RADIANCE");
  if (exposure !== undefined) {
    lines.push(`EXPOSURE=${exposure}`);
  }
  if (gamma !== undefined) {
    lines.push(`GAMMA=${gamma}`);
  }
  lines.push("FORMAT=32-bit_rle_rgbe");
  lines.push(""); // Empty line marks end of header

  // Resolution
  lines.push(`-Y ${height} +X ${width}`);

  // Convert header to bytes
  const headerStr = lines.join("\n") + "\n";
  const headerBytes = new TextEncoder().encode(headerStr);

  // Generate pixel data
  let pixelBytes: Uint8Array;

  if (useRLE) {
    // Create RLE-encoded data for each scanline
    const scanlineBytes: number[] = [];

    for (let y = 0; y < height; y++) {
      // RLE header: 0x02 0x02 <width high> <width low>
      scanlineBytes.push(2, 2, (width >> 8) & 0xff, width & 0xff);

      // Encode each channel with a simple run
      for (let channel = 0; channel < 4; channel++) {
        // All pixels in this channel have the same value (run)
        const value = channel < 3 ? 128 : 136; // RGB=128, E=136 (middle gray)
        if (width <= 127) {
          // Single run
          scanlineBytes.push(128 + width, value);
        } else {
          // Multiple runs
          let remaining = width;
          while (remaining > 0) {
            const runLength = Math.min(remaining, 127);
            scanlineBytes.push(128 + runLength, value);
            remaining -= runLength;
          }
        }
      }
    }
    pixelBytes = new Uint8Array(scanlineBytes);
  } else if (pixels) {
    // Use provided pixels
    pixelBytes = new Uint8Array(width * height * 4);
    for (let i = 0; i < pixels.length && i < width * height; i++) {
      const [r, g, b, e] = pixels[i];
      pixelBytes[i * 4] = r;
      pixelBytes[i * 4 + 1] = g;
      pixelBytes[i * 4 + 2] = b;
      pixelBytes[i * 4 + 3] = e;
    }
  } else {
    // Flat (uncompressed) pixel data with default values
    pixelBytes = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      pixelBytes[i * 4] = 128; // R
      pixelBytes[i * 4 + 1] = 128; // G
      pixelBytes[i * 4 + 2] = 128; // B
      pixelBytes[i * 4 + 3] = 136; // E (exponent for ~1.0)
    }
  }

  // Combine header and pixels
  const result = new Uint8Array(headerBytes.length + pixelBytes.length);
  result.set(headerBytes, 0);
  result.set(pixelBytes, headerBytes.length);

  return result.buffer;
}

describe("RGBEParser", () => {
  describe("parse", () => {
    it("should parse a minimal valid HDR file", () => {
      const buffer = createRGBEBuffer({ width: 2, height: 2 });
      const result = parse(buffer);

      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
      expect(result.data.length).toBe(2 * 2 * 4); // RGBA
      expect(result.exposure).toBe(1.0);
      expect(result.gamma).toBe(1.0);
    });

    it("should parse header metadata", () => {
      const buffer = createRGBEBuffer({
        width: 1,
        height: 1,
        exposure: 2.5,
        gamma: 2.2,
      });
      const result = parse(buffer);

      expect(result.exposure).toBe(2.5);
      expect(result.gamma).toBe(2.2);
    });

    it("should handle cumulative exposure values", () => {
      // Create buffer with multiple EXPOSURE lines manually
      const header =
        "#?RADIANCE\nEXPOSURE=2.0\nEXPOSURE=0.5\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n";
      const headerBytes = new TextEncoder().encode(header);
      const pixelBytes = new Uint8Array([128, 128, 128, 136]);
      const combined = new Uint8Array(headerBytes.length + pixelBytes.length);
      combined.set(headerBytes, 0);
      combined.set(pixelBytes, headerBytes.length);

      const result = parse(combined.buffer);
      expect(result.exposure).toBe(1.0); // 2.0 * 0.5 = 1.0
    });

    it("should parse RLE-encoded data", () => {
      const buffer = createRGBEBuffer({ width: 64, height: 2, useRLE: true });
      const result = parse(buffer);

      expect(result.width).toBe(64);
      expect(result.height).toBe(2);
      expect(result.data.length).toBe(64 * 2 * 4);
    });

    it("should convert RGBE to correct float values", () => {
      // Create a 1x1 image with known RGBE value
      // RGBE encoding: float_value = mantissa * 2^(exponent - 128 - 8)
      // For exponent=136: scale = 2^(136-128-8) = 2^0 = 1
      // So R=128 gives 128 * 1 = 128.0 (not 0.5!)
      //
      // To get 1.0: we need mantissa * 2^(e-136) = 1.0
      // With mantissa=128 and e=129: 128 * 2^(129-136) = 128 * 2^-7 = 128/128 = 1.0
      const buffer = createRGBEBuffer({
        width: 1,
        height: 1,
        pixels: [[128, 128, 128, 129]], // 128 * 2^(129-136) = 1.0
      });
      const result = parse(buffer);

      expect(result.data[0]).toBeCloseTo(1.0, 5); // R
      expect(result.data[1]).toBeCloseTo(1.0, 5); // G
      expect(result.data[2]).toBeCloseTo(1.0, 5); // B
      expect(result.data[3]).toBe(1); // A is always 1
    });

    it("should handle zero exponent (black pixels)", () => {
      const buffer = createRGBEBuffer({
        width: 1,
        height: 1,
        pixels: [[255, 255, 255, 0]], // E=0 means black regardless of RGB
      });
      const result = parse(buffer);

      expect(result.data[0]).toBe(0);
      expect(result.data[1]).toBe(0);
      expect(result.data[2]).toBe(0);
      expect(result.data[3]).toBe(1);
    });

    it("should handle high dynamic range values", () => {
      // E=160 -> scale = 2^(160-128-8) = 2^24 / 256 = 65536
      // With R=255: 255 * 2^(160-128-8) = 255 * 16777216 / 256 ≈ 16711680
      const buffer = createRGBEBuffer({
        width: 1,
        height: 1,
        pixels: [[255, 0, 0, 160]],
      });
      const result = parse(buffer);

      expect(result.data[0]).toBeGreaterThan(10000); // Very bright red
      expect(result.data[1]).toBe(0);
      expect(result.data[2]).toBe(0);
    });

    it("should handle low dynamic range values", () => {
      // E=100 -> scale = 2^(100-128-8) = 2^-36 ≈ very small
      const buffer = createRGBEBuffer({
        width: 1,
        height: 1,
        pixels: [[255, 255, 255, 100]],
      });
      const result = parse(buffer);

      expect(result.data[0]).toBeLessThan(0.001); // Very dim
      expect(result.data[0]).toBeGreaterThan(0); // But not zero
    });
  });

  describe("error handling", () => {
    it("should throw on invalid magic number", () => {
      const bytes = new TextEncoder().encode(
        "INVALID\n-Y 1 +X 1\n\x80\x80\x80\x88",
      );
      expect(() => parse(bytes.buffer)).toThrow(RGBEParserError);
      expect(() => parse(bytes.buffer)).toThrow(/magic number/);
    });

    it("should throw on invalid resolution string", () => {
      const bytes = new TextEncoder().encode(
        "#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\nINVALID\n",
      );
      expect(() => parse(bytes.buffer)).toThrow(RGBEParserError);
      expect(() => parse(bytes.buffer)).toThrow(/resolution/i);
    });

    it("should throw on unsupported format", () => {
      const bytes = new TextEncoder().encode(
        "#?RADIANCE\nFORMAT=unsupported_format\n\n-Y 1 +X 1\n\x80\x80\x80\x88",
      );
      expect(() => parse(bytes.buffer)).toThrow(RGBEParserError);
      expect(() => parse(bytes.buffer)).toThrow(/Unsupported/);
    });

    it("should throw on truncated pixel data", () => {
      const bytes = new TextEncoder().encode(
        "#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 2\n\x80\x80", // Only 2 bytes instead of 16
      );
      expect(() => parse(bytes.buffer)).toThrow(RGBEParserError);
    });

    it("should throw on excessive dimensions", () => {
      const bytes = new TextEncoder().encode(
        "#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 99999 +X 99999\n",
      );
      expect(() => parse(bytes.buffer)).toThrow(RGBEParserError);
      expect(() => parse(bytes.buffer)).toThrow(/too large/);
    });

    it("should accept #?RGBE magic number", () => {
      const header = "#?RGBE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n";
      const headerBytes = new TextEncoder().encode(header);
      const pixelBytes = new Uint8Array([128, 128, 128, 136]);
      const combined = new Uint8Array(headerBytes.length + pixelBytes.length);
      combined.set(headerBytes, 0);
      combined.set(pixelBytes, headerBytes.length);

      const result = parse(combined.buffer);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    });
  });

  describe("resolution string variants", () => {
    it("should parse +X width -Y height format", () => {
      const header = "#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n+X 3 -Y 2\n";
      const headerBytes = new TextEncoder().encode(header);
      const pixelBytes = new Uint8Array(3 * 2 * 4).fill(136);
      const combined = new Uint8Array(headerBytes.length + pixelBytes.length);
      combined.set(headerBytes, 0);
      combined.set(pixelBytes, headerBytes.length);

      const result = parse(combined.buffer);
      expect(result.width).toBe(3);
      expect(result.height).toBe(2);
    });
  });
});
