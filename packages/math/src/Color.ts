/**
 * Represents an immutable RGBA color with floating-point components (0.0 to 1.0).
 *
 * @example
 * ```ts
 * const red = new Color(1, 0, 0);
 * const semiTransparent = new Color(1, 0, 0, 0.5);
 * const fromHex = Color.fromHex('#ff0000');
 * ```
 */
export class Color {
  // Predefined color constants
  static readonly RED = new Color(1, 0, 0);
  static readonly GREEN = new Color(0, 1, 0);
  static readonly BLUE = new Color(0, 0, 1);
  static readonly WHITE = new Color(1, 1, 1);
  static readonly BLACK = new Color(0, 0, 0);
  static readonly YELLOW = new Color(1, 1, 0);
  static readonly CYAN = new Color(0, 1, 1);
  static readonly MAGENTA = new Color(1, 0, 1);

  private readonly _r: number;
  private readonly _g: number;
  private readonly _b: number;
  private readonly _a: number;

  /**
   * Creates a new Color instance with RGBA components.
   * @param r - The red component (default: 0)
   * @param g - The green component (default: 0)
   * @param b - The blue component (default: 0)
   * @param a - The alpha component (default: 1)
   */
  constructor(r = 0, g = 0, b = 0, a = 1) {
    this._r = r;
    this._g = g;
    this._b = b;
    this._a = a;
  }

  get r(): number {
    return this._r;
  }

  get g(): number {
    return this._g;
  }

  get b(): number {
    return this._b;
  }

  get a(): number {
    return this._a;
  }

  /**
   * Converts this color to an RGB array.
   * @returns A 3-element array [r, g, b]
   */
  toArray(): [number, number, number] {
    return [this._r, this._g, this._b];
  }

  /**
   * Converts this color to an RGBA array.
   * @returns A 4-element array [r, g, b, a]
   */
  toArray4(): [number, number, number, number] {
    return [this._r, this._g, this._b, this._a];
  }

  /**
   * Converts this color to a Float32Array suitable for WebGPU buffers.
   * @returns A Float32Array containing [r, g, b, a]
   */
  toFloat32Array(): Float32Array {
    return new Float32Array([this._r, this._g, this._b, this._a]);
  }

  /**
   * Converts this color to a hex string in #RRGGBB format.
   * @returns A hex color string (alpha channel excluded)
   */
  toHex(): string {
    const r = Math.round(this._r * 255)
      .toString(16)
      .padStart(2, "0");
    const g = Math.round(this._g * 255)
      .toString(16)
      .padStart(2, "0");
    const b = Math.round(this._b * 255)
      .toString(16)
      .padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  /**
   * Creates a deep copy of this color.
   * @returns A new Color instance with identical RGBA values
   */
  clone(): Color {
    return new Color(this._r, this._g, this._b, this._a);
  }

  /**
   * Checks if this color equals another color by comparing all RGBA components.
   * @param other - The color to compare with
   * @returns True if all components are equal, false otherwise
   */
  equals(other: Color): boolean {
    return (
      this._r === other._r &&
      this._g === other._g &&
      this._b === other._b &&
      this._a === other._a
    );
  }

  /**
   * Creates a Color from an RGB or RGBA array.
   * @param arr - A 3-element [r, g, b] or 4-element [r, g, b, a] array
   * @returns A new Color instance
   */
  static fromArray(
    arr: [number, number, number] | [number, number, number, number],
  ): Color {
    return new Color(arr[0], arr[1], arr[2], arr[3] ?? 1);
  }

  /**
   * Creates a Color from an array or Color instance using duck typing.
   * @param value - An RGB/RGBA array or Color-like object
   * @returns A new Color instance
   */
  static from(
    value: [number, number, number] | [number, number, number, number] | Color,
  ): Color {
    // NOTE(ghlee): Duck typing check for Color-like objects (handles cross-bundle instanceof issues)
    if (
      typeof value === "object" &&
      value !== null &&
      "r" in value &&
      "g" in value &&
      "b" in value &&
      typeof (value as Color).r === "number"
    ) {
      const c = value as Color;
      return new Color(c.r, c.g, c.b, c.a ?? 1);
    }
    return Color.fromArray(value as [number, number, number]);
  }

  /**
   * Creates a Color from a hex string (#RGB or #RRGGBB format).
   * @param hex - A hex color string like '#ff0000' or '#f00'
   * @returns A new Color instance with alpha set to 1.0
   */
  static fromHex(hex: string): Color {
    let h = hex.replace("#", "");

    // #RGB → #RRGGBB
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }

    if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) {
      throw new Error(`Invalid hex color format: ${hex}`);
    }

    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;

    return new Color(r, g, b);
  }

  toString(): string {
    return `Color(${this._r}, ${this._g}, ${this._b}, ${this._a})`;
  }
}
