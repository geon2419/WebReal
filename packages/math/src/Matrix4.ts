import { Vector3 } from "./Vector3.js";

/**
 * Represents a 4x4 matrix in column-major order (compatible with WebGPU/OpenGL).
 *
 * Memory Layout:
 * [m0  m4  m8   m12]   [col0.x  col1.x  col2.x  col3.x]
 * [m1  m5  m9   m13] = [col0.y  col1.y  col2.y  col3.y]
 * [m2  m6  m10  m14]   [col0.z  col1.z  col2.z  col3.z]
 * [m3  m7  m11  m15]   [col0.w  col1.w  col2.w  col3.w]
 *
 * @example
 * ```ts
 * const m = new Matrix4();
 * m.translate(new Vector3(5, 0, 0)).rotateY(Math.PI / 4);
 * const point = m.transformPoint(new Vector3(1, 0, 0));
 * ```
 */
export class Matrix4 {
  private _data: Float32Array;

  /**
   * Creates a new Matrix4 initialized to the identity matrix.
   */
  constructor() {
    // Initialize to identity matrix.
    this._data = new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
  }

  get data(): Float32Array {
    return this._data;
  }

  /**
   * Resets this matrix to the identity matrix.
   * @returns This matrix for method chaining
   */
  identity(): this {
    this._data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return this;
  }

  /**
   * Multiplies this matrix by another matrix.
   * @param other - The matrix to multiply with
   * @returns A new Matrix4 representing the product
   */
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

  /**
   * Applies a translation transformation to this matrix.
   * @param v - The translation vector
   * @returns This matrix for method chaining
   */
  translate(v: Vector3): this {
    const t = Matrix4.translation(v);
    const result = this.multiply(t);
    this._data.set(result._data);
    return this;
  }

  /**
   * Applies a scaling transformation to this matrix.
   * @param v - The scaling factors for x, y, z axes
   * @returns This matrix for method chaining
   */
  scale(v: Vector3): this {
    const s = Matrix4.scaling(v);
    const result = this.multiply(s);
    this._data.set(result._data);
    return this;
  }

  /**
   * Applies a rotation around the X-axis to this matrix.
   * @param angle - The rotation angle in radians
   * @returns This matrix for method chaining
   */
  rotateX(angle: number): this {
    const r = Matrix4.rotationX(angle);
    const result = this.multiply(r);
    this._data.set(result._data);
    return this;
  }

  /**
   * Applies a rotation around the Y-axis to this matrix.
   * @param angle - The rotation angle in radians
   * @returns This matrix for method chaining
   */
  rotateY(angle: number): this {
    const r = Matrix4.rotationY(angle);
    const result = this.multiply(r);
    this._data.set(result._data);
    return this;
  }

  /**
   * Applies a rotation around the Z-axis to this matrix.
   * @param angle - The rotation angle in radians
   * @returns This matrix for method chaining
   */
  rotateZ(angle: number): this {
    const r = Matrix4.rotationZ(angle);
    const result = this.multiply(r);
    this._data.set(result._data);
    return this;
  }

  /**
   * Creates a copy of this matrix.
   * @returns A new Matrix4 with the same values
   */
  clone(): Matrix4 {
    const m = new Matrix4();
    m._data.set(this._data);
    return m;
  }

  /**
   * Computes the transpose of this matrix.
   * Swaps rows and columns.
   * @returns A new Matrix4 that is the transpose of this matrix.
   */
  transpose(): Matrix4 {
    const m = this._data;
    const result = new Matrix4();
    const out = result._data;

    out[0] = m[0];
    out[1] = m[4];
    out[2] = m[8];
    out[3] = m[12];
    out[4] = m[1];
    out[5] = m[5];
    out[6] = m[9];
    out[7] = m[13];
    out[8] = m[2];
    out[9] = m[6];
    out[10] = m[10];
    out[11] = m[14];
    out[12] = m[3];
    out[13] = m[7];
    out[14] = m[11];
    out[15] = m[15];

    return result;
  }

  /**
   * Computes the inverse of this matrix.
   * Uses cofactor expansion method for 4x4 matrix inversion.
   * @returns A new Matrix4 that is the inverse of this matrix.
   *          Returns identity matrix if the matrix is singular (determinant is 0).
   */
  inverse(): Matrix4 {
    const m = this._data;
    const result = new Matrix4();
    const inv = result._data;

    // Calculate cofactors
    const a00 = m[0],
      a01 = m[1],
      a02 = m[2],
      a03 = m[3];
    const a10 = m[4],
      a11 = m[5],
      a12 = m[6],
      a13 = m[7];
    const a20 = m[8],
      a21 = m[9],
      a22 = m[10],
      a23 = m[11];
    const a30 = m[12],
      a31 = m[13],
      a32 = m[14],
      a33 = m[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    // Calculate determinant
    let det =
      b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (Math.abs(det) < 1e-10) {
      // Matrix is singular, return identity
      return result;
    }

    det = 1.0 / det;

    inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return result;
  }

  /**
   * Creates a translation matrix.
   * @param v - The translation vector
   * @returns A new Matrix4 representing the translation
   */
  static translation(v: Vector3): Matrix4 {
    const m = new Matrix4();
    m._data[12] = v.x;
    m._data[13] = v.y;
    m._data[14] = v.z;
    return m;
  }

  /**
   * Creates a scaling matrix.
   * @param v - The scaling factors for x, y, z axes
   * @returns A new Matrix4 representing the scaling
   */
  static scaling(v: Vector3): Matrix4 {
    const m = new Matrix4();
    m._data[0] = v.x;
    m._data[5] = v.y;
    m._data[10] = v.z;
    return m;
  }

  /**
   * Creates a rotation matrix around the X-axis.
   * @param angle - The rotation angle in radians
   * @returns A new Matrix4 representing the rotation
   */
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

  /**
   * Creates a rotation matrix around the Y-axis.
   * @param angle - The rotation angle in radians
   * @returns A new Matrix4 representing the rotation
   */
  static rotationY(angle: number): Matrix4 {
    const m = new Matrix4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    m._data[0] = c;
    m._data[2] = -s;
    m._data[8] = s;
    m._data[10] = c;
    return m;
  }

  /**
   * Creates a rotation matrix around the Z-axis.
   * @param angle - The rotation angle in radians
   * @returns A new Matrix4 representing the rotation
   */
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

  /**
   * Creates a perspective projection matrix.
   * @param fovY - The vertical field of view in radians
   * @param aspect - The aspect ratio (width / height)
   * @param near - The near clipping plane distance (must be positive)
   * @param far - The far clipping plane distance (must be positive)
   * @returns A new Matrix4 representing the perspective projection
   */
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
   * Creates an orthographic projection matrix for WebGPU depth range [0, 1].
   * @param left - The left clipping plane coordinate
   * @param right - The right clipping plane coordinate
   * @param bottom - The bottom clipping plane coordinate
   * @param top - The top clipping plane coordinate
   * @param near - The near clipping plane distance
   * @param far - The far clipping plane distance
   * @returns A new Matrix4 representing the orthographic projection
   */
  static orthographic(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number
  ): Matrix4 {
    const m = new Matrix4();
    const e = m._data;

    // Orthographic projection for WebGPU depth range [0, 1] using a right-handed
    // view space where visible geometry is in front of the camera at z ∈ [-near, -far].
    e[0] = 2 / (right - left);
    e[5] = 2 / (top - bottom);
    e[10] = 1 / (near - far);
    e[12] = -(right + left) / (right - left);
    e[13] = -(top + bottom) / (top - bottom);
    e[14] = near / (near - far);
    e[15] = 1;

    // Reset any remaining terms to zero (matrix starts as identity)
    e[1] = e[2] = e[3] = 0;
    e[4] = e[6] = e[7] = 0;
    e[8] = e[9] = e[11] = 0;

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
    const forward = eye.sub(target);

    // Edge case: eye and target are at the same position
    if (forward.length < 1e-6) {
      return new Matrix4();
    }

    const zAxis = forward.normalize();
    let xAxis = up.cross(zAxis);

    // Edge case: up vector is parallel to the viewing direction
    if (xAxis.length < 1e-6) {
      const altUp =
        Math.abs(zAxis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
      xAxis = altUp.cross(zAxis).normalize();
    } else {
      xAxis = xAxis.normalize();
    }

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

  /**
   * Transforms a point by this matrix (applies full transformation including translation).
   * Performs perspective division by w component.
   * @param v - The point to transform
   * @returns A new Vector3 representing the transformed point
   */
  transformPoint(v: Vector3): Vector3 {
    const m = this._data;
    const x = v.x;
    const y = v.y;
    const z = v.z;

    const w = m[3] * x + m[7] * y + m[11] * z + m[15];

    const outX = m[0] * x + m[4] * y + m[8] * z + m[12];
    const outY = m[1] * x + m[5] * y + m[9] * z + m[13];
    const outZ = m[2] * x + m[6] * y + m[10] * z + m[14];

    // Perspective division
    if (Math.abs(w) > 1e-10) {
      return new Vector3(outX / w, outY / w, outZ / w);
    }

    return new Vector3(outX, outY, outZ);
  }

  /**
   * Transforms a direction vector by this matrix (ignores translation).
   * Useful for transforming normals, rays, or any directional vectors.
   * @param v - The direction vector to transform
   * @returns A new Vector3 representing the transformed direction
   */
  transformDirection(v: Vector3): Vector3 {
    const m = this._data;
    const x = v.x;
    const y = v.y;
    const z = v.z;

    const outX = m[0] * x + m[4] * y + m[8] * z;
    const outY = m[1] * x + m[5] * y + m[9] * z;
    const outZ = m[2] * x + m[6] * y + m[10] * z;

    return new Vector3(outX, outY, outZ);
  }
}
