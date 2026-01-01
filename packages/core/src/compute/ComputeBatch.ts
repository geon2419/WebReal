import { ComputeShaderError } from "./ComputeShaderError";
import { ComputeShader } from "./ComputeShader";
import type { ComputeProfiler } from "./ComputeProfiler";

export type ComputeWorkgroupCount =
  | [number, number?, number?]
  | { x: number; y?: number; z?: number };

/**
 * Options for creating a ComputeBatch.
 */
export interface ComputeBatchOptions {
  /** Optional label for debugging */
  label?: string;
  /** Optional profiler for timestamp queries */
  profiler?: ComputeProfiler;
  /** How to encode passes for the batch (default: "single") */
  passMode?: "single" | "perDispatch";
}

/**
 * Options for a single dispatch within a batch.
 */
export interface ComputeDispatchOptions {
  /** The compute shader to execute */
  shader: ComputeShader;
  /** Workgroup counts */
  workgroups: ComputeWorkgroupCount;
  /**
   * Bind group entries keyed by group index.
   * Used to create bind groups internally.
   */
  bindings?: Record<number, GPUBindGroupEntry[]>;
  /** Pre-built bind groups keyed by group index */
  bindGroups?: Record<number, GPUBindGroup>;
  /** Optional label for debugging */
  label?: string;
}

/**
 * Batches multiple compute dispatches into a single command submission.
 * Hides bind group and pass creation behind a simple add/submit API.
 *
 * @example
 * ```ts
 * const batch = new ComputeBatch(device, { passMode: "single" });
 * batch.add({
 *   shader,
 *   workgroups: [64],
 *   bindings: { 0: [{ binding: 0, resource: { buffer: dataBuffer } }] },
 * });
 * await batch.submitAsync();
 * ```
 */
export class ComputeBatch {
  private _device: GPUDevice;
  private _entries: ComputeDispatchOptions[] = [];
  private _label?: string;
  private _profiler?: ComputeProfiler;
  private _passMode: "single" | "perDispatch";

  /**
   * Creates a new ComputeBatch.
   *
   * @param device - The WebGPU device
   * @param options - Batch configuration options
   * @throws {ComputeShaderError} If device is not provided
   */
  constructor(device: GPUDevice, options: ComputeBatchOptions = {}) {
    if (!device) {
      throw new ComputeShaderError("GPUDevice is required");
    }

    this._device = device;
    this._label = options.label;
    this._profiler = options.profiler;
    this._passMode = options.passMode ?? "single";
  }

  /**
   * Adds a dispatch entry to the batch.
   *
   * @param entry - Dispatch configuration
   * @returns This ComputeBatch instance for chaining
   * @throws {ComputeShaderError} If entry or shader is not provided
   */
  add(entry: ComputeDispatchOptions): this {
    if (!entry) {
      throw new ComputeShaderError("Dispatch entry is required");
    }
    if (!entry.shader) {
      throw new ComputeShaderError("ComputeShader is required");
    }
    if (!entry.workgroups) {
      throw new ComputeShaderError("Workgroups are required");
    }

    this._entries.push(entry);
    return this;
  }

  /**
   * Clears all queued dispatch entries.
   *
   * @returns This ComputeBatch instance for chaining
   */
  clear(): this {
    this._entries.length = 0;
    return this;
  }

  /**
   * Submits the batch for execution.
   *
   * @throws {ComputeShaderError} If no entries are queued
   */
  submit(): void {
    this._encodeAndSubmit();
  }

  /**
   * Submits the batch and waits for completion.
   *
   * @returns Promise that resolves when GPU work is complete
   */
  async submitAsync(): Promise<void> {
    this._encodeAndSubmit();
    await this._device.queue.onSubmittedWorkDone();
  }

  /**
   * Encodes the batch into command buffers and submits once.
   *
   * @throws {ComputeShaderError} If entries are invalid or missing
   */
  private _encodeAndSubmit(): void {
    if (this._entries.length === 0) {
      throw new ComputeShaderError("No dispatch entries to submit");
    }

    if (this._profiler && this._passMode === "perDispatch") {
      if (this._entries.length > 1) {
        throw new ComputeShaderError(
          "Profiler requires passMode 'single' or a single dispatch"
        );
      }
    }

    const encoder = this._device.createCommandEncoder({
      label: this._label ? `${this._label} CommandEncoder` : undefined,
    });

    if (this._passMode === "single") {
      const passEncoder = encoder.beginComputePass({
        label: this._label ? `${this._label} ComputePass` : undefined,
        timestampWrites: this._profiler?.getTimestampWrites(),
      });

      for (const entry of this._entries) {
        this._encodeEntry(passEncoder, entry);
      }

      passEncoder.end();
    } else {
      for (const entry of this._entries) {
        const baseLabel = entry.label ?? this._label;
        const passEncoder = encoder.beginComputePass({
          label: baseLabel ? `${baseLabel} ComputePass` : undefined,
          timestampWrites: this._profiler?.getTimestampWrites(),
        });

        this._encodeEntry(passEncoder, entry);
        passEncoder.end();
      }
    }

    this._profiler?.resolve(encoder);
    this._device.queue.submit([encoder.finish()]);

    this.clear();
  }

  /**
   * Encodes a single dispatch into a compute pass.
   *
   * @param passEncoder - The compute pass encoder
   * @param entry - The dispatch configuration
   */
  private _encodeEntry(
    passEncoder: GPUComputePassEncoder,
    entry: ComputeDispatchOptions
  ): void {
    const pipeline = entry.shader.getPipeline();
    passEncoder.setPipeline(pipeline);

    const bindGroups = this._collectBindGroups(entry);
    for (const [index, bindGroup] of bindGroups) {
      passEncoder.setBindGroup(index, bindGroup);
    }

    const { x, y, z } = this._normalizeWorkgroups(entry.workgroups);
    passEncoder.dispatchWorkgroups(x, y, z);
  }

  /**
   * Builds bind groups from entry bindings or uses provided bind groups.
   *
   * @param entry - The dispatch configuration
   * @returns Sorted bind groups by index
   * @throws {ComputeShaderError} If bind groups are missing or conflicting
   */
  private _collectBindGroups(
    entry: ComputeDispatchOptions
  ): Array<[number, GPUBindGroup]> {
    const bindGroups = new Map<number, GPUBindGroup>();
    const baseLabel = entry.label ?? this._label;

    if (entry.bindings) {
      for (const [key, entries] of Object.entries(entry.bindings)) {
        const index = this._parseBindGroupIndex(key, "bindings");
        const label = baseLabel ? `${baseLabel} BindGroup ${index}` : undefined;
        const bindGroup = entry.shader.createBindGroup(index, entries, label);
        bindGroups.set(index, bindGroup);
      }
    }

    if (entry.bindGroups) {
      for (const [key, bindGroup] of Object.entries(entry.bindGroups)) {
        const index = this._parseBindGroupIndex(key, "bindGroups");
        if (bindGroups.has(index)) {
          throw new ComputeShaderError(
            `Bind group ${index} provided in both bindings and bindGroups`
          );
        }
        bindGroups.set(index, bindGroup);
      }
    }

    if (bindGroups.size === 0) {
      throw new ComputeShaderError(
        "At least one bind group must be set for dispatch"
      );
    }

    return [...bindGroups.entries()].sort((a, b) => a[0] - b[0]);
  }

  /**
   * Parses and validates bind group indices from object keys.
   *
   * @param key - The key to parse
   * @param source - The source map name for error reporting
   * @returns The parsed bind group index
   * @throws {ComputeShaderError} If the index is invalid
   */
  private _parseBindGroupIndex(key: string, source: string): number {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) {
      throw new ComputeShaderError(
        `Invalid bind group index "${key}" in ${source}`
      );
    }
    return index;
  }

  /**
   * Normalizes workgroup inputs to {x, y, z}.
   *
   * @param workgroups - The workgroup input format
   * @returns Normalized workgroup counts
   */
  private _normalizeWorkgroups(workgroups: ComputeWorkgroupCount): {
    x: number;
    y: number;
    z: number;
  } {
    if (Array.isArray(workgroups)) {
      return {
        x: workgroups[0],
        y: workgroups[1] ?? 1,
        z: workgroups[2] ?? 1,
      };
    }

    return {
      x: workgroups.x,
      y: workgroups.y ?? 1,
      z: workgroups.z ?? 1,
    };
  }
}
