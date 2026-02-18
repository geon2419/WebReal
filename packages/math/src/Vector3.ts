/**
 * Represents a 3D vector with x, y, z components.
 *
 * @example
 * ```ts
 * const v1 = new Vector3(1, 2, 3);
 * const v2 = new Vector3(4, 5, 6);
 * const sum = v1.add(v2); // Vector3(5, 7, 9)
 * const normalized = v1.normalize(); // Unit vector
 * ```
 */
export class Vector3 {
  private _data: Float32Array;

  /**
   * Creates a new Vector3 instance.
   * @param x - The x component (default: 0)
   * @param y - The y component (default: 0)
   * @param z - The z component (default: 0)
   */
  constructor(x = 0, y = 0, z = 0) {
    this._data = new Float32Array([x, y, z]);
  }

  get x(): number {
    return this._data[0];
  }
  set x(value: number) {
    this._data[0] = value;
  }

  get y(): number {
    return this._data[1];
  }
  set y(value: number) {
    this._data[1] = value;
  }

  get z(): number {
    return this._data[2];
  }
  set z(value: number) {
    this._data[2] = value;
  }

  get data(): Float32Array {
    return this._data;
  }

  /**
   * Calculates the length (magnitude) of this vector.
   * @returns The Euclidean length of the vector
   */
  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
   * Adds another vector to this vector and returns a new Vector3.
   * @param v - The vector to add
   * @returns A new Vector3 representing the sum
   */
  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  /**
   * Subtracts another vector from this vector and returns a new Vector3.
   * @param v - The vector to subtract
   * @returns A new Vector3 representing the difference
   */
  sub(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  /**
   * Scales this vector by a scalar value and returns a new Vector3.
   * @param s - The scalar multiplier
   * @returns A new Vector3 scaled by the given factor
   */
  scale(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  /**
   * Calculates the dot product of this vector with another vector.
   * @param v - The vector to compute dot product with
   * @returns The scalar dot product value
   */
  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  /**
   * Calculates the cross product of this vector with another vector.
   * @param v - The vector to compute cross product with
   * @returns A new Vector3 perpendicular to both input vectors
   */
  cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  /**
   * Normalizes this vector to unit length.
   * @returns A new Vector3 with length 1 in the same direction, or zero vector if length is 0
   */
  normalize(): Vector3 {
    const len = this.length;

    if (len === 0) {
      return new Vector3();
    }

    return this.scale(1 / len);
  }

  /**
   * Creates a copy of this vector.
   * @returns A new Vector3 with the same components
   */
  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  /**
   * Sets the x, y, z components of this vector.
   * @param x - The new x component
   * @param y - The new y component
   * @param z - The new z component
   * @returns This vector for method chaining
   */
  set(x: number, y: number, z: number): this {
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
    return this;
  }

  /**
   * Calculates the Euclidean distance from this vector to another vector.
   * @param v - The target vector to measure distance to
   * @returns The Euclidean distance between the two vectors
   */
  distanceTo(v: Vector3): number {
    return Math.sqrt(this.distanceToSquared(v));
  }

  /**
   * Calculates the squared Euclidean distance from this vector to another vector.
   * @param v - The target vector to measure distance to
   * @returns The squared distance, useful for comparisons without expensive sqrt operation
   */
  distanceToSquared(v: Vector3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Returns a new vector with the minimum component values from two vectors.
   * @param a - The first vector
   * @param b - The second vector
   * @returns A new Vector3 with component-wise minimum values
   */
  static min(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.min(a.z, b.z),
    );
  }

  /**
   * Returns a new vector with the maximum component values from two vectors.
   * @param a - The first vector
   * @param b - The second vector
   * @returns A new Vector3 with component-wise maximum values
   */
  static max(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(
      Math.max(a.x, b.x),
      Math.max(a.y, b.y),
      Math.max(a.z, b.z),
    );
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }
}
