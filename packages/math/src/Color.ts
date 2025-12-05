/**
 * Immutable RGBA color class.
 * RGB values are required, alpha is optional (default: 1.0)
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
   * Converts to RGB tuple.
   */
  toArray(): [number, number, number] {
    return [this._r, this._g, this._b];
  }

  /**
   * Converts to RGBA tuple.
   */
  toArray4(): [number, number, number, number] {
    return [this._r, this._g, this._b, this._a];
  }

  /**
   * Converts to RGBA Float32Array (for GPU buffers).
   */
  toFloat32Array(): Float32Array {
    return new Float32Array([this._r, this._g, this._b, this._a]);
  }

  /**
   * Converts to hex string (excludes alpha).
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
   * Creates a copy of this color.
   */
  clone(): Color {
    return new Color(this._r, this._g, this._b, this._a);
  }

  /**
   * Checks equality with another Color.
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
   * Creates Color from RGB or RGBA array.
   */
  static fromArray(
    arr: [number, number, number] | [number, number, number, number]
  ): Color {
    return new Color(arr[0], arr[1], arr[2], arr[3] ?? 1);
  }

  /**
   * Creates Color from tuple or Color instance (for union type handling).
   * Uses duck typing to check for Color-like objects to handle cross-bundle instanceof issues.
   */
  static from(
    value: [number, number, number] | [number, number, number, number] | Color
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
   * Creates Color from hex string (#RGB or #RRGGBB supported).
   */
  static fromHex(hex: string): Color {
    let h = hex.replace("#", "");

    // #RGB → #RRGGBB
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
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
