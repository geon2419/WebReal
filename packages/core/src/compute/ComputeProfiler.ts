import { ComputeShaderError } from "./ComputeShaderError";

/**
 * Options for creating a ComputeProfiler.
 */
export interface ComputeProfilerOptions {
  /** Optional label for debugging */
  label?: string;
}

/**
 * A profiler for measuring compute shader execution time using GPU timestamp queries.
 * Gracefully falls back to no-op when 'timestamp-query' feature is not supported.
 *
 * Uses the timestampWrites API for compute pass profiling.
 *
 * @example
 * ```ts
 * // Request timestamp-query feature when creating engine
 * const engine = await Engine.create({
 *   canvas,
 *   requiredFeatures: ['timestamp-query'],
 * });
 *
 * const profiler = new ComputeProfiler(engine.device);
 * const pass = new ComputePass(device, { shader, profiler });
 *
 * pass.dispatch(64, 1, 1);
 *
 * const timeNs = await profiler.resolveAsync();
 * console.log(`Execution time: ${timeNs / 1_000_000} ms`);
 * ```
 */
export class ComputeProfiler {
  private _querySet: GPUQuerySet | null = null;
  private _resolveBuffer: GPUBuffer | null = null;
  private _resultBuffer: GPUBuffer | null = null;
  private _isSupported: boolean;
  private _label?: string;
  private _hasTimestampWrites = false;

  /** Number of timestamps (begin and end) */
  private static readonly TIMESTAMP_COUNT = 2;
  /** Size of each timestamp in bytes (BigInt64) */
  private static readonly TIMESTAMP_SIZE = 8;
  /** Total buffer size for timestamps */
  private static readonly BUFFER_SIZE =
    ComputeProfiler.TIMESTAMP_COUNT * ComputeProfiler.TIMESTAMP_SIZE;

  /**
   * Creates a new ComputeProfiler.
   *
   * @param device - The WebGPU device
   * @param options - Profiler configuration options
   */
  constructor(device: GPUDevice, options: ComputeProfilerOptions = {}) {
    if (!device) {
      throw new ComputeShaderError("GPUDevice is required");
    }

    this._label = options.label;
    this._isSupported = device.features.has("timestamp-query");

    if (!this._isSupported) {
      console.warn(
        "[ComputeProfiler] 'timestamp-query' feature not supported. Profiling will be disabled.",
      );
      return;
    }

    // Create query set for begin/end timestamps
    this._querySet = device.createQuerySet({
      label: this._label
        ? `${this._label} QuerySet`
        : "ComputeProfiler QuerySet",
      type: "timestamp",
      count: ComputeProfiler.TIMESTAMP_COUNT,
    });

    // Buffer to resolve query results
    this._resolveBuffer = device.createBuffer({
      label: this._label
        ? `${this._label} ResolveBuffer`
        : "ComputeProfiler ResolveBuffer",
      size: ComputeProfiler.BUFFER_SIZE,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });

    // Buffer for CPU readback
    this._resultBuffer = device.createBuffer({
      label: this._label
        ? `${this._label} ResultBuffer`
        : "ComputeProfiler ResultBuffer",
      size: ComputeProfiler.BUFFER_SIZE,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Whether timestamp queries are supported
   * @returns True if supported, false otherwise
   */
  get isSupported(): boolean {
    return this._isSupported;
  }

  /**
   * The query set for timestamp writes
   * @returns The GPUQuerySet, or null if not supported
   */
  get querySet(): GPUQuerySet | null {
    return this._querySet;
  }

  /**
   * Gets the timestampWrites descriptor for a compute pass.
   * Use this when creating a compute pass to enable profiling.
   *
   * @returns The timestampWrites descriptor, or undefined if not supported
   *
   * @example
   * ```ts
   * const passEncoder = encoder.beginComputePass({
   *   timestampWrites: profiler.getTimestampWrites(),
   * });
   * ```
   */
  getTimestampWrites(): GPUComputePassTimestampWrites | undefined {
    if (!this._isSupported || !this._querySet) {
      return undefined;
    }

    this._hasTimestampWrites = true;

    return {
      querySet: this._querySet,
      beginningOfPassWriteIndex: 0,
      endOfPassWriteIndex: 1,
    };
  }

  /**
   * Resolves the timestamp queries to a buffer.
   * Called automatically by ComputePass when profiler is attached.
   *
   * @param encoder - The command encoder
   * @internal
   */
  resolve(encoder: GPUCommandEncoder): void {
    if (
      !this._isSupported ||
      !this._querySet ||
      !this._resolveBuffer ||
      !this._resultBuffer
    ) {
      return;
    }

    encoder.resolveQuerySet(
      this._querySet,
      0,
      ComputeProfiler.TIMESTAMP_COUNT,
      this._resolveBuffer,
      0,
    );

    encoder.copyBufferToBuffer(
      this._resolveBuffer,
      0,
      this._resultBuffer,
      0,
      ComputeProfiler.BUFFER_SIZE,
    );
  }

  /**
   * Reads the profiling result asynchronously.
   * Returns the execution time in nanoseconds, or 0 if profiling is not supported.
   *
   * @returns Promise resolving to execution time in nanoseconds
   * @throws {ComputeShaderError} If called before timestamps were written or if mapping fails
   */
  async resolveAsync(): Promise<number> {
    if (!this._isSupported) {
      return 0;
    }

    if (!this._hasTimestampWrites) {
      throw new ComputeShaderError(
        "Profiler must have getTimestampWrites() called and used in a compute pass before resolveAsync",
      );
    }

    if (!this._resultBuffer) {
      throw new ComputeShaderError("Result buffer not initialized");
    }

    try {
      await this._resultBuffer.mapAsync(GPUMapMode.READ);
      const mappedRange = this._resultBuffer.getMappedRange();
      const timestamps = new BigInt64Array(mappedRange);

      const beginTime = timestamps[0];
      const endTime = timestamps[1];

      this._resultBuffer.unmap();

      // Reset state for next measurement
      this._hasTimestampWrites = false;

      return Number(endTime - beginTime);
    } catch (error) {
      throw new ComputeShaderError("Failed to read profiling results", error);
    }
  }

  /**
   * Resets the profiler state for a new measurement.
   */
  reset(): void {
    this._hasTimestampWrites = false;
  }

  /**
   * Destroys the profiler and releases GPU resources.
   */
  destroy(): void {
    this._querySet?.destroy();
    this._resolveBuffer?.destroy();
    this._resultBuffer?.destroy();
    this._querySet = null;
    this._resolveBuffer = null;
    this._resultBuffer = null;
  }
}
