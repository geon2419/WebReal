export class Vector3 {
  private _data: Float32Array;

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

  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  add(v: Vector3): Vector3 {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vector3): Vector3 {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s: number): Vector3 {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vector3): Vector3 {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  normalize(): Vector3 {
    const len = this.length;

    if (len === 0) {
      return new Vector3();
    }

    return this.scale(1 / len);
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  set(x: number, y: number, z: number): this {
    this._data[0] = x;
    this._data[1] = y;
    this._data[2] = z;
    return this;
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }
}
