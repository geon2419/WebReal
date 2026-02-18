/**
 * IEEE 754 half-precision (float16) conversion utilities.
 *
 * WebGPU's `rgba16float` format requires data as `Uint16Array` with
 * half-precision float encoding. These utilities convert between
 * JavaScript's native float64/float32 and float16.
 *
 * @module Float16
 */

// Float16 special value constants
const FLOAT16_NAN = 0x7e00;
const FLOAT16_POSITIVE_INFINITY = 0x7c00;
const FLOAT16_NEGATIVE_INFINITY = 0xfc00;
const FLOAT16_NEGATIVE_ZERO = 0x8000;
const FLOAT16_POSITIVE_ZERO = 0x0000;

/**
 * Converts a JavaScript number (float64) to IEEE 754 half-precision (float16).
 *
 * @param value - The number to convert
 * @returns The float16 value encoded as a 16-bit unsigned integer
 *
 * @example
 * ```ts
 * const half = toFloat16(1.0);  // 0x3C00
 * const half = toFloat16(0.5);  // 0x3800
 * ```
 */
export function toFloat16(value: number): number {
  // Handle special cases
  if (Number.isNaN(value)) {
    return FLOAT16_NAN;
  }

  if (!Number.isFinite(value)) {
    return value > 0 ? FLOAT16_POSITIVE_INFINITY : FLOAT16_NEGATIVE_INFINITY;
  }

  if (value === 0) {
    return Object.is(value, -0) ? FLOAT16_NEGATIVE_ZERO : FLOAT16_POSITIVE_ZERO;
  }

  // Use DataView for IEEE 754 bit manipulation
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, false); // Big-endian for easier bit extraction
  const bits = view.getUint32(0, false);

  // Extract IEEE 754 single-precision components
  const sign = (bits >>> 31) & 0x1;
  const exponent = (bits >>> 23) & 0xff;
  const mantissa = bits & 0x7fffff;

  const halfSign = sign << 15;
  let halfExponent: number;
  let halfMantissa: number;

  if (exponent === 0) {
    // Denormalized float32 -> zero in float16 (too small)
    return halfSign;
  } else if (exponent === 0xff) {
    // Infinity or NaN
    halfExponent = 0x1f;
    halfMantissa = mantissa ? 0x200 : 0; // Preserve NaN vs Inf
  } else {
    // Normalized number
    const newExponent = exponent - 127 + 15; // Rebias exponent

    if (newExponent >= 0x1f) {
      // Overflow -> Infinity
      halfExponent = 0x1f;
      halfMantissa = 0;
    } else if (newExponent <= 0) {
      // Underflow -> denormalized or zero
      if (newExponent < -10) {
        // Too small, flush to zero
        return halfSign;
      }

      // Denormalized float16
      const shift = 1 - newExponent;
      halfMantissa = (0x800000 | mantissa) >> (shift + 13);
      halfExponent = 0;

      // Round to nearest even
      const roundBit = ((0x800000 | mantissa) >> (shift + 12)) & 1;
      if (roundBit && halfMantissa & 1) {
        halfMantissa++;
      }
    } else {
      // Normal case
      halfExponent = newExponent;
      halfMantissa = mantissa >> 13;

      // Round to nearest even
      const roundBit = (mantissa >> 12) & 1;
      const stickyBits = mantissa & 0xfff;
      if (roundBit && (stickyBits || halfMantissa & 1)) {
        halfMantissa++;
        if (halfMantissa > 0x3ff) {
          halfMantissa = 0;
          halfExponent++;
          if (halfExponent >= 0x1f) {
            // Overflow to infinity
            return halfSign | FLOAT16_POSITIVE_INFINITY;
          }
        }
      }
    }
  }

  return halfSign | (halfExponent << 10) | halfMantissa;
}

/**
 * Converts an IEEE 754 half-precision (float16) value to a JavaScript number.
 *
 * @param half - The float16 value encoded as a 16-bit unsigned integer
 * @returns The JavaScript number (float64)
 *
 * @example
 * ```ts
 * const value = fromFloat16(0x3C00);  // 1.0
 * const value = fromFloat16(0x3800);  // 0.5
 * ```
 */
export function fromFloat16(half: number): number {
  if (half < 0 || half > 0xffff || !Number.isInteger(half)) {
    throw new Error(
      `Invalid float16 value: ${half}. Must be an integer in range [0, 65535]`,
    );
  }

  const sign = (half >>> 15) & 0x1;
  const exponent = (half >>> 10) & 0x1f;
  const mantissa = half & 0x3ff;

  if (exponent === 0) {
    if (mantissa === 0) {
      // Zero
      return sign ? -0 : 0;
    }
    // Denormalized number
    return (sign ? -1 : 1) * mantissa * 2 ** -24; // 2^-14 * mantissa/1024
  } else if (exponent === 0x1f) {
    // Infinity or NaN
    return mantissa ? NaN : sign ? -Infinity : Infinity;
  }

  // Normalized number
  return (sign ? -1 : 1) * (1 + mantissa / 1024) * 2 ** (exponent - 15);
}

/**
 * Converts a Float32Array to a Uint16Array with float16 encoding.
 *
 * @param float32 - The source Float32Array
 * @returns A new Uint16Array with float16-encoded values
 *
 * @example
 * ```ts
 * const rgba32 = new Float32Array([1.0, 0.5, 0.25, 1.0]);
 * const rgba16 = toFloat16Array(rgba32);
 * // Use rgba16 for WebGPU rgba16float texture upload
 * ```
 */
export function toFloat16Array(float32: Float32Array): Uint16Array {
  const result = new Uint16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    result[i] = toFloat16(float32[i]);
  }
  return result;
}

/**
 * Converts a Uint16Array with float16 encoding to a Float32Array.
 *
 * @param float16 - The source Uint16Array with float16 values
 * @returns A new Float32Array with the converted values
 *
 * @example
 * ```ts
 * const rgba16 = new Uint16Array([0x3C00, 0x3800, 0x3400, 0x3C00]);
 * const rgba32 = fromFloat16Array(rgba16);
 * // [1.0, 0.5, 0.25, 1.0]
 * ```
 */
export function fromFloat16Array(float16: Uint16Array): Float32Array {
  const result = new Float32Array(float16.length);
  for (let i = 0; i < float16.length; i++) {
    result[i] = fromFloat16(float16[i]);
  }
  return result;
}
