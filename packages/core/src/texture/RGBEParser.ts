/**
 * Radiance HDR (RGBE) file format parser.
 *
 * Parses .hdr files in the Radiance RGBE format, which stores HDR images
 * using shared exponent encoding (R, G, B, Exponent). Supports standard
 * RGBE format, RLE compression, and header metadata.
 *
 * @module RGBEParser
 */

// RGBE format constants
const RGBE_EXPONENT_BIAS = 128;
const RGBE_MANTISSA_BITS = 8;
const RLE_MARKER = 0x02;
const RLE_RUN_THRESHOLD = 128;
const MAX_IMAGE_DIMENSION = 16384;
const RGBA_CHANNELS = 4;
const NEWLINE_CHAR = 0x0a;
const CARRIAGE_RETURN_CHAR = 0x0d;

/**
 * Parsed RGBE file data with width, height, linear RGBA float values, and metadata.
 */
export interface RGBEResult {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Linear RGBA float data (length = width * height * 4) */
  data: Float32Array;
  /** Exposure value from header (default: 1.0) */
  exposure: number;
  /** Gamma value from header (default: 1.0) */
  gamma: number;
}

/**
 * Error thrown when RGBE parsing fails.
 */
export class RGBEParserError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RGBEParserError";
  }
}

/**
 * Parses a Radiance HDR (RGBE) file buffer into linear floating-point RGBA data.
 * @param buffer - The raw ArrayBuffer containing the HDR file data
 * @returns Parsed RGBE result with width, height, data, exposure, and gamma
 * @throws {RGBEParserError} If the file format is invalid or parsing fails
 *
 * @example
 * ```ts
 * const response = await fetch('environment.hdr');
 * const buffer = await response.arrayBuffer();
 * const { width, height, data, exposure } = parse(buffer);
 * // data is Float32Array of RGBA values in linear space
 * ```
 */
export function parse(buffer: ArrayBuffer): RGBEResult {
  const bytes = new Uint8Array(buffer);
  let pos = 0;

  // Parse header
  const header = parseHeader(bytes, pos);
  pos = header.endPosition;

  // Parse resolution string
  const resolution = parseResolution(bytes, pos);
  pos = resolution.endPosition;

  const { width, height } = resolution;
  const pixelCount = width * height;

  // Allocate output buffer (RGBA float)
  const data = new Float32Array(pixelCount * RGBA_CHANNELS);

  // Allocate reusable scanline buffer for RLE decoding (avoid repeated allocations)
  const scanlineBuffer = new Uint8Array(width * RGBA_CHANNELS);

  // Parse pixel data
  parsePixelData(bytes, pos, width, height, data, scanlineBuffer);

  return {
    width,
    height,
    data,
    exposure: header.exposure,
    gamma: header.gamma,
  };
}

interface HeaderResult {
  format: string;
  exposure: number;
  gamma: number;
  endPosition: number;
}

/**
 * Parses the RGBE file header and extracts format, exposure, and gamma metadata.
 * @param bytes - The byte array containing the HDR file
 * @param startPos - Starting position in the byte array
 * @returns Header metadata and the position after the header
 */
function parseHeader(bytes: Uint8Array, startPos: number): HeaderResult {
  let pos = startPos;
  let format = "32-bit_rle_rgbe";
  let exposure = 1.0;
  let gamma = 1.0;

  // Read first line - should be magic number
  const firstLine = readLine(bytes, pos);
  pos = firstLine.endPosition;

  // Check magic number
  const magic = firstLine.line.trim();
  if (magic !== "#?RADIANCE" && magic !== "#?RGBE") {
    throw new RGBEParserError(
      `Invalid HDR file: expected "#?RADIANCE" or "#?RGBE" magic number, got "${magic}"`,
    );
  }

  // Parse header lines until empty line
  while (pos < bytes.length) {
    const lineResult = readLine(bytes, pos);
    pos = lineResult.endPosition;
    const line = lineResult.line.trim();

    if (line === "") {
      break;
    }

    if (line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("FORMAT=")) {
      format = line.substring(7).trim();
      if (format !== "32-bit_rle_rgbe" && format !== "32-bit_rle_xyze") {
        throw new RGBEParserError(`Unsupported HDR format: ${format}`);
      }
    }

    if (line.startsWith("EXPOSURE=")) {
      const value = parseFloat(line.substring(9));
      if (!Number.isNaN(value)) {
        // Exposure values are cumulative according to RGBE specification
        // Multiple EXPOSURE lines multiply together to get final exposure
        exposure *= value;
      }
    }

    if (line.startsWith("GAMMA=")) {
      const value = parseFloat(line.substring(6));
      if (!Number.isNaN(value)) {
        gamma = value;
      }
    }
  }

  return { format, exposure, gamma, endPosition: pos };
}

interface ResolutionResult {
  width: number;
  height: number;
  endPosition: number;
}

/**
 * Parses the resolution string from the HDR file header.
 * @param bytes - The byte array containing the HDR file
 * @param startPos - Starting position in the byte array
 * @returns Image dimensions and the position after the resolution string
 */
function parseResolution(
  bytes: Uint8Array,
  startPos: number,
): ResolutionResult {
  const lineResult = readLine(bytes, startPos);
  const line = lineResult.line.trim();

  // Parse resolution string: "-Y height +X width" or "+X width -Y height"
  const match = line.match(/^([+-][XY])\s+(\d+)\s+([+-][XY])\s+(\d+)$/);
  if (!match) {
    throw new RGBEParserError(
      `Invalid resolution string: "${line}". Expected format like "-Y 1024 +X 2048"`,
    );
  }

  let width: number;
  let height: number;

  // Parse based on axis order
  if (match[1].includes("Y")) {
    height = parseInt(match[2], 10);
    width = parseInt(match[4], 10);
  } else {
    width = parseInt(match[2], 10);
    height = parseInt(match[4], 10);
  }

  if (width <= 0 || height <= 0) {
    throw new RGBEParserError(
      `Invalid image dimensions: ${width}x${height} (both width and height must be positive)`,
    );
  }

  // Sanity check for reasonable image size
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new RGBEParserError(
      `Image dimensions too large: ${width}x${height}. Maximum supported: ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}`,
    );
  }

  return { width, height, endPosition: lineResult.endPosition };
}

/**
 * Parses pixel data with automatic RLE detection and converts to linear float RGBA.
 * @param bytes - The byte array containing pixel data
 * @param startPos - Starting position in the byte array
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param output - Output Float32Array buffer for RGBA data
 * @param scanlineBuffer - Reusable buffer for RLE decoding to avoid repeated allocations
 */
function parsePixelData(
  bytes: Uint8Array,
  startPos: number,
  width: number,
  height: number,
  output: Float32Array,
  scanlineBuffer: Uint8Array,
): void {
  let pos = startPos;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * RGBA_CHANNELS;

    // Check if this scanline uses new-style RLE
    if (
      pos + RGBA_CHANNELS <= bytes.length &&
      isNewStyleRLE(bytes, pos, width)
    ) {
      pos = decodeScanlineRLE(
        bytes,
        pos,
        width,
        output,
        rowOffset,
        scanlineBuffer,
      );
    } else {
      // Old-style format (uncompressed or old RLE)
      pos = decodeScanlineFlat(bytes, pos, width, output, rowOffset);
    }
  }
}

/**
 * Checks if the scanline uses new-style RLE encoding.
 * @param bytes - The byte array containing scanline data
 * @param pos - Current position in the byte array
 * @param width - Expected scanline width
 * @returns True if the scanline uses new-style RLE
 */
function isNewStyleRLE(bytes: Uint8Array, pos: number, width: number): boolean {
  // New-style RLE starts with: 0x02 0x02 <width high byte> <width low byte>
  return (
    bytes[pos] === RLE_MARKER &&
    bytes[pos + 1] === RLE_MARKER &&
    bytes[pos + 2] === ((width >> 8) & 0xff) &&
    bytes[pos + 3] === (width & 0xff)
  );
}

/**
 * Decodes a scanline with new-style RLE encoding where each channel is encoded separately.
 * @param bytes - The byte array containing RLE-encoded scanline data
 * @param startPos - Starting position in the byte array
 * @param width - Scanline width in pixels
 * @param output - Output Float32Array buffer for RGBA data
 * @param rowOffset - Offset in the output array for this scanline
 * @param scanline - Reusable buffer for scanline RGBE data to avoid allocations
 * @returns The position after decoding the scanline
 */
function decodeScanlineRLE(
  bytes: Uint8Array,
  startPos: number,
  width: number,
  output: Float32Array,
  rowOffset: number,
  scanline: Uint8Array,
): number {
  let pos = startPos + RGBA_CHANNELS; // Skip RLE header

  // Decode each channel separately (R, G, B, E)
  for (let channel = 0; channel < RGBA_CHANNELS; channel++) {
    let pixelIndex = 0;

    while (pixelIndex < width) {
      if (pos >= bytes.length) {
        throw new RGBEParserError(
          `Unexpected end of RLE data at position ${pos} while decoding channel ${channel}`,
        );
      }

      const code = bytes[pos++];

      if (code > RLE_RUN_THRESHOLD) {
        // Run of same value (RLE compressed)
        const count = code - RLE_RUN_THRESHOLD;
        if (pixelIndex + count > width) {
          throw new RGBEParserError(
            `RLE run length ${count} exceeds remaining scanline width ${
              width - pixelIndex
            } at channel ${channel}`,
          );
        }

        if (pos >= bytes.length) {
          throw new RGBEParserError(
            `Unexpected end of data while reading RLE run value at position ${pos}`,
          );
        }

        const value = bytes[pos++];
        for (let i = 0; i < count; i++) {
          scanline[pixelIndex * RGBA_CHANNELS + channel] = value;
          pixelIndex++;
        }
      } else {
        // Non-run (literal values)
        const count = code;
        if (pixelIndex + count > width) {
          throw new RGBEParserError(
            `RLE literal count ${count} exceeds remaining scanline width ${
              width - pixelIndex
            } at channel ${channel}`,
          );
        }

        for (let i = 0; i < count; i++) {
          if (pos >= bytes.length) {
            throw new RGBEParserError(
              `Unexpected end of data while reading RLE literal values at position ${pos}`,
            );
          }
          scanline[pixelIndex * RGBA_CHANNELS + channel] = bytes[pos++];
          pixelIndex++;
        }
      }
    }
  }

  // Convert RGBE scanline to float RGBA
  for (let x = 0; x < width; x++) {
    const srcIdx = x * RGBA_CHANNELS;
    const dstIdx = rowOffset + x * RGBA_CHANNELS;
    rgbeToFloat(
      scanline[srcIdx],
      scanline[srcIdx + 1],
      scanline[srcIdx + 2],
      scanline[srcIdx + 3],
      output,
      dstIdx,
    );
  }

  return pos;
}

/**
 * Decodes an uncompressed scanline in flat format.
 * @param bytes - The byte array containing uncompressed scanline data
 * @param startPos - Starting position in the byte array
 * @param width - Scanline width in pixels
 * @param output - Output Float32Array buffer for RGBA data
 * @param rowOffset - Offset in the output array for this scanline
 * @returns The position after decoding the scanline
 */
function decodeScanlineFlat(
  bytes: Uint8Array,
  startPos: number,
  width: number,
  output: Float32Array,
  rowOffset: number,
): number {
  const bytesNeeded = width * RGBA_CHANNELS;

  // Check bounds once before the loop for better performance
  if (startPos + bytesNeeded > bytes.length) {
    throw new RGBEParserError(
      `Unexpected end of pixel data: need ${bytesNeeded} bytes but only ${
        bytes.length - startPos
      } bytes remaining at position ${startPos}`,
    );
  }

  let pos = startPos;

  for (let x = 0; x < width; x++) {
    const dstIdx = rowOffset + x * RGBA_CHANNELS;
    rgbeToFloat(
      bytes[pos],
      bytes[pos + 1],
      bytes[pos + 2],
      bytes[pos + 3],
      output,
      dstIdx,
    );
    pos += RGBA_CHANNELS;
  }

  return pos;
}

/**
 * Converts a single RGBE pixel to linear float RGBA.
 * RGBE encoding uses a shared exponent: value = mantissa * 2^(exponent - bias - mantissa_bits)
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @param e - Shared exponent (0-255)
 * @param output - Output Float32Array buffer
 * @param index - Starting index in output array for this pixel
 */
function rgbeToFloat(
  r: number,
  g: number,
  b: number,
  e: number,
  output: Float32Array,
  index: number,
): void {
  if (e === 0) {
    // Zero exponent means black
    output[index] = 0;
    output[index + 1] = 0;
    output[index + 2] = 0;
    output[index + 3] = 1; // Alpha is always 1
  } else {
    // Calculate the scale factor: 2^(e - EXPONENT_BIAS - MANTISSA_BITS)
    const scale = Math.pow(2, e - RGBE_EXPONENT_BIAS - RGBE_MANTISSA_BITS);
    output[index] = r * scale;
    output[index + 1] = g * scale;
    output[index + 2] = b * scale;
    output[index + 3] = 1; // Alpha is always 1
  }
}

/**
 * Reads a line from the byte array terminated by newline.
 * Uses TextDecoder for efficient and safe string conversion.
 * @param bytes - The byte array to read from
 * @param startPos - Starting position in the byte array
 * @returns The line string and position after the newline
 */
function readLine(
  bytes: Uint8Array,
  startPos: number,
): { line: string; endPosition: number } {
  let endPos = startPos;

  // Find line ending
  while (endPos < bytes.length && bytes[endPos] !== NEWLINE_CHAR) {
    endPos++;
  }

  // Convert to string (handle potential \r\n)
  let lineEnd = endPos;
  if (lineEnd > startPos && bytes[lineEnd - 1] === CARRIAGE_RETURN_CHAR) {
    lineEnd--;
  }

  // Use TextDecoder for efficient string conversion (avoids stack overflow with large lines)
  const decoder = new TextDecoder("ascii");
  const line = decoder.decode(bytes.subarray(startPos, lineEnd));

  // Move past the newline
  return { line, endPosition: endPos + 1 };
}
