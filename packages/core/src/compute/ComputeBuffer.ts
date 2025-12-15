import { ComputeShaderError } from "./ComputeShaderError";

/**
 * Options for creating a ComputeBuffer.
 */
export interface ComputeBufferOptions {
  /** The size of the buffer in bytes */
  size: number;
  /** Optional label for debugging */
  label?: string;
  /**
   * Additional buffer usage flags to combine with STORAGE | COPY_SRC | COPY_DST.
   * Useful for adding VERTEX or UNIFORM usage for interop with render pipelines.
   */
  additionalUsage?: GPUBufferUsageFlags;
}

/**
 * A GPU storage buffer wrapper for compute shader operations.
 * Provides convenient methods for writing data to and reading data from the GPU.
 *
 * @example
 * ```ts
 * const buffer = new ComputeBuffer(device, { size: 1024 });
 * buffer.write(new Float32Array([1, 2, 3, 4]));
 *
 * // After compute pass execution...
 * const result = await buffer.readAsync();
 * const data = new Float32Array(result);
 * ```
 */
export class ComputeBuffer {
  private _device: GPUDevice;
  private _buffer: GPUBuffer;
  private _size: number;

  /**
   * Creates a new ComputeBuffer.
   *
   * @param device - The WebGPU device
   * @param options - Buffer configuration options
   * @throws {ComputeShaderError} If device is not provided or size is invalid
   */
  constructor(device: GPUDevice, options: ComputeBufferOptions) {
    if (!device) {
      throw new ComputeShaderError("GPUDevice is required");
    }
    if (!options.size || options.size <= 0) {
      throw new ComputeShaderError("Buffer size must be greater than 0");
    }

    this._device = device;
    this._size = options.size;

    const baseUsage =
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST;

    this._buffer = device.createBuffer({
      label: options.label ?? "ComputeBuffer",
      size: options.size,
      usage: baseUsage | (options.additionalUsage ?? 0),
    });
  }

  /** The underlying GPUBuffer */
  get gpuBuffer(): GPUBuffer {
    return this._buffer;
  }

  /** The size of the buffer in bytes */
  get size(): number {
    return this._size;
  }

  /**
   * Writes data to the GPU buffer.
   *
   * @param data - The data to write (ArrayBuffer or TypedArray)
   * @param bufferOffset - Byte offset in the GPU buffer (default: 0)
   * @param dataOffset - Byte offset in the source data (default: 0)
   * @param size - Number of bytes to write (default: entire data)
   * @throws {ComputeShaderError} If data exceeds buffer size
   */
  write(
    data: ArrayBufferLike | ArrayBufferView,
    bufferOffset = 0,
    dataOffset?: number,
    size?: number
  ): void {
    const sourceData = ArrayBuffer.isView(data) ? data.buffer : data;
    const actualDataOffset = dataOffset ?? 0;
    const actualSize = size ?? sourceData.byteLength - actualDataOffset;

    if (bufferOffset + actualSize > this._size) {
      throw new ComputeShaderError(
        `Data size (${actualSize}) exceeds buffer capacity at offset ${bufferOffset}`
      );
    }

    this._device.queue.writeBuffer(
      this._buffer,
      bufferOffset,
      sourceData,
      actualDataOffset,
      actualSize
    );
  }

  /**
   * Reads data from the GPU buffer asynchronously.
   * Creates a staging buffer for each read operation (simple implementation).
   *
   * @param offset - Byte offset to start reading from (default: 0)
   * @param size - Number of bytes to read (default: entire buffer)
   * @returns Promise resolving to an ArrayBuffer containing the data
   * @throws {ComputeShaderError} If buffer mapping fails
   */
  async readAsync(offset = 0, size?: number): Promise<ArrayBuffer> {
    const readSize = size ?? this._size - offset;

    if (offset + readSize > this._size) {
      throw new ComputeShaderError(
        `Read range (${offset} + ${readSize}) exceeds buffer size (${this._size})`
      );
    }

    // Create staging buffer for readback
    const stagingBuffer = this._device.createBuffer({
      label: "ComputeBuffer Staging",
      size: readSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    try {
      // Copy from storage buffer to staging buffer
      const encoder = this._device.createCommandEncoder({
        label: "ComputeBuffer Read Encoder",
      });
      encoder.copyBufferToBuffer(
        this._buffer,
        offset,
        stagingBuffer,
        0,
        readSize
      );
      this._device.queue.submit([encoder.finish()]);

      // Map and read the staging buffer
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const mappedRange = stagingBuffer.getMappedRange();

      // Copy data before unmapping
      const result = mappedRange.slice(0);

      stagingBuffer.unmap();
      return result;
    } catch (error) {
      throw new ComputeShaderError("Failed to read buffer data", error);
    } finally {
      stagingBuffer.destroy();
    }
  }

  /**
   * Destroys the underlying GPU buffer and releases resources.
   */
  destroy(): void {
    this._buffer.destroy();
  }
}
