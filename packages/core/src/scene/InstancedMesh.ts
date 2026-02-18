import { Matrix4 } from "@web-real/math";
import type { Geometry } from "../geometry/Geometry";
import type { Material } from "../material/Material";
import { Mesh } from "./Mesh";

/**
 * Instance data mode - determines the data structure per instance
 * - 'matrix': Full 4x4 transform matrix (16 floats) + color (4 floats) = 80 bytes
 * - 'position': Position (3 floats + 1 padding) + color (4 floats) = 32 bytes
 */
export type InstancedMeshMode = "matrix" | "position";

export interface InstancedMeshOptions {
  /**
   * Instance data mode
   * - 'matrix': Use full transform matrix per instance (supports rotation/scale)
   * - 'position': Use position only per instance (lightweight, uniform scale via instanceSize)
   * @default 'matrix'
   */
  mode?: InstancedMeshMode;
  /**
   * Uniform size for all instances when mode='position'
   * @default 1.0
   */
  instanceSize?: number;
}

// Storage buffer layout sizes (must match WGSL struct alignment)
// WGSL struct alignment rules:
// - vec3<f32> has alignment 16, size 12 (rounds up to 16 with padding)
// - vec4<f32> has alignment 16, size 16
// - mat4x4<f32> has alignment 16, size 64
const MATRIX_INSTANCE_SIZE = 80; // mat4x4<f32>(64) + vec4<f32>(16)
const POSITION_INSTANCE_SIZE = 32; // vec3<f32>(12) + padding(4) + vec4<f32>(16)

/**
 * A mesh that can render multiple instances in a single draw call using GPU instancing.
 * GPU instancing dramatically improves performance when rendering many identical
 * geometries with different transforms/colors by reducing draw calls from N to 1.
 *
 * The renderer binds the instance storage buffer to `@group(2) @binding(0)` for use in WGSL.
 * @example
 * ```ts
 * const mesh = new InstancedMesh(
 *   new BoxGeometry(1, 1, 1),
 *   new BasicMaterial({ color: new Color(1, 1, 1) }),
 *   1000,
 *   { mode: 'position', instanceSize: 0.5 }
 * );
 *
 * for (let i = 0; i < 1000; i++) {
 *   mesh.setPositionAt(i, Math.random() * 100, Math.random() * 100, Math.random() * 100);
 *   mesh.setColorAt(i, Math.random(), Math.random(), Math.random(), 1);
 * }
 *
 * scene.add(mesh);
 * ```
 */
export class InstancedMesh extends Mesh {
  private _instanceCount: number;
  private _mode: InstancedMeshMode;
  private _instanceSize: number;
  private _instanceData: Float32Array;
  private _storageBuffer: GPUBuffer | null = null;
  private _needsStorageUpdate: boolean = true;

  /**
   * Creates a new InstancedMesh.
   * @param geometry - The geometry to instance
   * @param material - The material to use for rendering
   * @param count - Number of instances to render
   * @param options - Instance configuration options
   */
  constructor(
    geometry: Geometry,
    material: Material,
    count: number,
    options: InstancedMeshOptions = {},
  ) {
    super(geometry, material);

    this._instanceCount = count;
    this._mode = options.mode ?? "matrix";
    this._instanceSize = options.instanceSize ?? 1.0;

    // Allocate instance data buffer
    const bytesPerInstance =
      this._mode === "matrix" ? MATRIX_INSTANCE_SIZE : POSITION_INSTANCE_SIZE;
    const floatsPerInstance = bytesPerInstance / 4;
    this._instanceData = new Float32Array(count * floatsPerInstance);

    // Initialize all instances with identity matrix or zero position and white color
    this._initializeInstanceData();
  }

  /**
   * Gets the number of instances this mesh will render.
   * @returns The instance count
   */
  get instanceCount(): number {
    return this._instanceCount;
  }

  /**
   * Gets the instance data mode.
   * @returns The instancing mode
   */
  get mode(): InstancedMeshMode {
    return this._mode;
  }

  /**
   * Gets the uniform instance size (only used when mode='position').
   * @returns The instance size
   */
  get instanceSize(): number {
    return this._instanceSize;
  }

  /**
   * Sets the uniform instance size (only used when mode='position').
   * @param value - The instance size
   */
  set instanceSize(value: number) {
    this._instanceSize = value;
  }

  /**
   * Indicates whether the storage buffer needs to be updated on the GPU.
   * @returns True if an update is needed
   */
  get needsStorageUpdate(): boolean {
    return this._needsStorageUpdate;
  }

  /**
   * Gets the raw instance data array for advanced manipulation.
   * After modifying, call markStorageNeedsUpdate() to sync to GPU.
   * @returns The instance data array
   */
  get instanceData(): Float32Array {
    return this._instanceData;
  }

  /**
   * Initialize instance data with default values.
   */
  private _initializeInstanceData(): void {
    if (this._mode === "matrix") {
      // Initialize each instance with identity matrix and white color
      const floatsPerInstance = MATRIX_INSTANCE_SIZE / 4; // 20

      for (let i = 0; i < this._instanceCount; i++) {
        const offset = i * floatsPerInstance;

        // Identity matrix (column-major)
        // Column 0
        this._instanceData[offset + 0] = 1;
        this._instanceData[offset + 1] = 0;
        this._instanceData[offset + 2] = 0;
        this._instanceData[offset + 3] = 0;
        // Column 1
        this._instanceData[offset + 4] = 0;
        this._instanceData[offset + 5] = 1;
        this._instanceData[offset + 6] = 0;
        this._instanceData[offset + 7] = 0;
        // Column 2
        this._instanceData[offset + 8] = 0;
        this._instanceData[offset + 9] = 0;
        this._instanceData[offset + 10] = 1;
        this._instanceData[offset + 11] = 0;
        // Column 3
        this._instanceData[offset + 12] = 0;
        this._instanceData[offset + 13] = 0;
        this._instanceData[offset + 14] = 0;
        this._instanceData[offset + 15] = 1;

        // White color (rgba)
        this._instanceData[offset + 16] = 1;
        this._instanceData[offset + 17] = 1;
        this._instanceData[offset + 18] = 1;
        this._instanceData[offset + 19] = 1;
      }
    } else {
      // position mode
      const floatsPerInstance = POSITION_INSTANCE_SIZE / 4; // 8

      for (let i = 0; i < this._instanceCount; i++) {
        const offset = i * floatsPerInstance;

        // Position (0, 0, 0) + padding
        this._instanceData[offset + 0] = 0;
        this._instanceData[offset + 1] = 0;
        this._instanceData[offset + 2] = 0;
        this._instanceData[offset + 3] = 0; // padding

        // White color (rgba)
        this._instanceData[offset + 4] = 1;
        this._instanceData[offset + 5] = 1;
        this._instanceData[offset + 6] = 1;
        this._instanceData[offset + 7] = 1;
      }
    }
  }

  /**
   * Sets the transform matrix for an instance (matrix mode only).
   * @param index - Instance index (0 to count-1)
   * @param matrix - Transform matrix to set
   * @throws Error if mode is 'position'
   */
  setMatrixAt(index: number, matrix: Matrix4): void {
    if (this._mode !== "matrix") {
      throw new Error(
        "setMatrixAt() is only available in matrix mode. Use setPositionAt() for position mode.",
      );
    }

    if (index < 0 || index >= this._instanceCount) {
      throw new Error(
        `Instance index ${index} out of bounds (0-${this._instanceCount - 1})`,
      );
    }

    const floatsPerInstance = MATRIX_INSTANCE_SIZE / 4;
    const offset = index * floatsPerInstance;
    const matrixData = matrix.data;

    // Copy matrix elements (column-major, 16 floats)
    for (let i = 0; i < 16; i++) {
      this._instanceData[offset + i] = matrixData[i];
    }

    this._needsStorageUpdate = true;
  }

  /**
   * Gets the transform matrix for an instance (matrix mode only).
   * @param index - Instance index (0 to count-1)
   * @returns The transform matrix for the instance
   * @throws Error if mode is 'position'
   */
  getMatrixAt(index: number): Matrix4 {
    if (this._mode !== "matrix") {
      throw new Error(
        "getMatrixAt() is only available in matrix mode. Use getPositionAt() for position mode.",
      );
    }

    if (index < 0 || index >= this._instanceCount) {
      throw new Error(
        `Instance index ${index} out of bounds (0-${this._instanceCount - 1})`,
      );
    }

    const floatsPerInstance = MATRIX_INSTANCE_SIZE / 4;
    const offset = index * floatsPerInstance;

    // Create new matrix and copy data into it
    const result = new Matrix4();
    const resultData = result.data;
    for (let i = 0; i < 16; i++) {
      resultData[i] = this._instanceData[offset + i];
    }

    return result;
  }

  /**
   * Sets the position for an instance (position mode only).
   * @param index - Instance index (0 to count-1)
   * @param x - X position
   * @param y - Y position
   * @param z - Z position
   * @throws Error if mode is 'matrix'
   */
  setPositionAt(index: number, x: number, y: number, z: number): void {
    if (this._mode !== "position") {
      throw new Error(
        "setPositionAt() is only available in position mode. Use setMatrixAt() for matrix mode.",
      );
    }

    if (index < 0 || index >= this._instanceCount) {
      throw new Error(
        `Instance index ${index} out of bounds (0-${this._instanceCount - 1})`,
      );
    }

    const floatsPerInstance = POSITION_INSTANCE_SIZE / 4;
    const offset = index * floatsPerInstance;

    this._instanceData[offset + 0] = x;
    this._instanceData[offset + 1] = y;
    this._instanceData[offset + 2] = z;

    this._needsStorageUpdate = true;
  }

  /**
   * Gets the position for an instance (position mode only).
   * @param index - Instance index (0 to count-1)
   * @returns Object with x, y, z position values
   * @throws Error if mode is 'matrix'
   */
  getPositionAt(index: number): { x: number; y: number; z: number } {
    if (this._mode !== "position") {
      throw new Error(
        "getPositionAt() is only available in position mode. Use getMatrixAt() for matrix mode.",
      );
    }

    if (index < 0 || index >= this._instanceCount) {
      throw new Error(
        `Instance index ${index} out of bounds (0-${this._instanceCount - 1})`,
      );
    }

    const floatsPerInstance = POSITION_INSTANCE_SIZE / 4;
    const offset = index * floatsPerInstance;

    return {
      x: this._instanceData[offset + 0],
      y: this._instanceData[offset + 1],
      z: this._instanceData[offset + 2],
    };
  }

  /**
   * Sets the color for an instance.
   * @param index - Instance index (0 to count-1)
   * @param r - Red component (0-1)
   * @param g - Green component (0-1)
   * @param b - Blue component (0-1)
   * @param a - Alpha component (0-1), default 1.0
   */
  setColorAt(
    index: number,
    r: number,
    g: number,
    b: number,
    a: number = 1,
  ): void {
    if (index < 0 || index >= this._instanceCount) {
      throw new Error(
        `Instance index ${index} out of bounds (0-${this._instanceCount - 1})`,
      );
    }

    let colorOffset: number;
    if (this._mode === "matrix") {
      const floatsPerInstance = MATRIX_INSTANCE_SIZE / 4;
      colorOffset = index * floatsPerInstance + 16; // After 16 matrix floats
    } else {
      const floatsPerInstance = POSITION_INSTANCE_SIZE / 4;
      colorOffset = index * floatsPerInstance + 4; // After position + padding
    }

    this._instanceData[colorOffset + 0] = r;
    this._instanceData[colorOffset + 1] = g;
    this._instanceData[colorOffset + 2] = b;
    this._instanceData[colorOffset + 3] = a;

    this._needsStorageUpdate = true;
  }

  /**
   * Gets the color for an instance.
   * @param index - Instance index (0 to count-1)
   * @returns Object with r, g, b, a color values
   */
  getColorAt(index: number): { r: number; g: number; b: number; a: number } {
    if (index < 0 || index >= this._instanceCount) {
      throw new Error(
        `Instance index ${index} out of bounds (0-${this._instanceCount - 1})`,
      );
    }

    let colorOffset: number;
    if (this._mode === "matrix") {
      const floatsPerInstance = MATRIX_INSTANCE_SIZE / 4;
      colorOffset = index * floatsPerInstance + 16;
    } else {
      const floatsPerInstance = POSITION_INSTANCE_SIZE / 4;
      colorOffset = index * floatsPerInstance + 4;
    }

    return {
      r: this._instanceData[colorOffset + 0],
      g: this._instanceData[colorOffset + 1],
      b: this._instanceData[colorOffset + 2],
      a: this._instanceData[colorOffset + 3],
    };
  }

  /**
   * Marks the storage buffer as needing an update.
   * Call this after directly modifying instanceData.
   */
  markStorageNeedsUpdate(): void {
    this._needsStorageUpdate = true;
  }

  /**
   * Gets or creates the GPU storage buffer for instance data.
   * @param device - GPUDevice to create the buffer on
   * @returns The storage buffer
   */
  getStorageBuffer(device: GPUDevice): GPUBuffer {
    if (!this._storageBuffer) {
      const byteSize = this._instanceData.byteLength;

      this._storageBuffer = device.createBuffer({
        size: byteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: `InstancedMesh-StorageBuffer-${this._instanceCount}`,
      });

      // Initial upload
      device.queue.writeBuffer(
        this._storageBuffer,
        0,
        this._instanceData as Float32Array<ArrayBuffer>,
      );
      this._needsStorageUpdate = false;
    }

    return this._storageBuffer;
  }

  /**
   * Updates the storage buffer with current instance data.
   * Should be called each frame before rendering if data has changed.
   * @param device - GPUDevice to write buffer data
   */
  updateStorageBuffer(device: GPUDevice): void {
    if (!this._needsStorageUpdate || !this._storageBuffer) {
      return;
    }

    device.queue.writeBuffer(
      this._storageBuffer,
      0,
      this._instanceData as Float32Array<ArrayBuffer>,
    );
    this._needsStorageUpdate = false;
  }

  /**
   * Gets the size in bytes per instance based on the mode.
   * @returns The instance byte size
   */
  getInstanceByteSize(): number {
    return this._mode === "matrix"
      ? MATRIX_INSTANCE_SIZE
      : POSITION_INSTANCE_SIZE;
  }

  /**
   * Disposes of GPU resources.
   */
  dispose(): void {
    if (this._storageBuffer) {
      this._storageBuffer.destroy();
      this._storageBuffer = null;
    }
  }
}
