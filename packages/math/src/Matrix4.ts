import { Vector3 } from "./Vector3.js";

/**
 * 4x4 Matrix Class
 * Column-major order (compatible with WebGPU/OpenGL)
 *
 * Memory Layout:
 * [m0  m4  m8   m12]   [col0.x  col1.x  col2.x  col3.x]
 * [m1  m5  m9   m13] = [col0.y  col1.y  col2.y  col3.y]
 * [m2  m6  m10  m14]   [col0.z  col1.z  col2.z  col3.z]
 * [m3  m7  m11  m15]   [col0.w  col1.w  col2.w  col3.w]
 */
export class Matrix4 {
  private _data: Float32Array;

  constructor() {
    // Initialize to identity matrix.
    this._data = new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
  }

  get data(): Float32Array {
    return this._data;
  }

  identity(): this {
    this._data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return this;
  }

  multiply(other: Matrix4): Matrix4 {
    const result = new Matrix4();
    const a = this._data;
    const b = other._data;
    const out = result._data;

    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[row + k * 4] * b[k + col * 4];
        }
        out[row + col * 4] = sum;
      }
    }
    return result;
  }

  translate(v: Vector3): this {
    const t = Matrix4.translation(v);
    const result = this.multiply(t);
    this._data.set(result._data);
    return this;
  }

  scale(v: Vector3): this {
    const s = Matrix4.scaling(v);
    const result = this.multiply(s);
    this._data.set(result._data);
    return this;
  }

  rotateY(angle: number): this {
    const r = Matrix4.rotationY(angle);
    const result = this.multiply(r);
    this._data.set(result._data);
    return this;
  }

  clone(): Matrix4 {
    const m = new Matrix4();
    m._data.set(this._data);
    return m;
  }

  static translation(v: Vector3): Matrix4 {
    const m = new Matrix4();
    m._data[12] = v.x;
    m._data[13] = v.y;
    m._data[14] = v.z;
    return m;
  }

  static scaling(v: Vector3): Matrix4 {
    const m = new Matrix4();
    m._data[0] = v.x;
    m._data[5] = v.y;
    m._data[10] = v.z;
    return m;
  }

  static rotationX(angle: number): Matrix4 {
    const m = new Matrix4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m._data[5] = c;
    m._data[6] = s;
    m._data[9] = -s;
    m._data[10] = c;
    return m;
  }

  static rotationY(angle: number): Matrix4 {
    const m = new Matrix4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m._data[0] = c;
    m._data[2] = s;
    m._data[8] = -s;
    m._data[10] = c;
    return m;
  }

  static rotationZ(angle: number): Matrix4 {
    const m = new Matrix4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m._data[0] = c;
    m._data[1] = s;
    m._data[4] = -s;
    m._data[5] = c;
    return m;
  }

  static perspective(
    fovY: number,
    aspect: number,
    near: number,
    far: number
  ): Matrix4 {
    const m = new Matrix4();
    // Focal length
    const f = 1.0 / Math.tan(fovY / 2);
    // Depth range
    const rangeInv = 1.0 / (near - far);

    // X Scale
    m._data[0] = f / aspect;
    // Y Scale
    m._data[5] = f;
    // Z Transform
    m._data[10] = far * rangeInv;
    // Perspective divide
    m._data[11] = -1;
    // Z Offset
    m._data[14] = near * far * rangeInv;
    // Homogeneous coordinate
    m._data[15] = 0;

    return m;
  }

  /**
   * Creates a view matrix that transforms world coordinates to camera coordinates.
   * @param eye - Camera position in world space
   * @param target - Point the camera is looking at
   * @param up - Up direction vector (typically (0, 1, 0))
   * @returns View matrix for use in the rendering pipeline
   *
   * @example
   * const viewMatrix = Matrix4.lookAt(
   *   new Vector3(0, 5, 10),  // Camera at (0, 5, 10)
   *   new Vector3(0, 0, 0),   // Looking at origin
   *   new Vector3(0, 1, 0)    // Y-axis is up
   * );
   */
  static lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
    const zAxis = eye.sub(target).normalize();
    const xAxis = up.cross(zAxis).normalize();
    const yAxis = zAxis.cross(xAxis);

    const m = new Matrix4();
    m._data[0] = xAxis.x;
    m._data[1] = yAxis.x;
    m._data[2] = zAxis.x;
    m._data[3] = 0;

    m._data[4] = xAxis.y;
    m._data[5] = yAxis.y;
    m._data[6] = zAxis.y;
    m._data[7] = 0;

    m._data[8] = xAxis.z;
    m._data[9] = yAxis.z;
    m._data[10] = zAxis.z;
    m._data[11] = 0;

    m._data[12] = -xAxis.dot(eye);
    m._data[13] = -yAxis.dot(eye);
    m._data[14] = -zAxis.dot(eye);
    m._data[15] = 1;

    return m;
  }
}
