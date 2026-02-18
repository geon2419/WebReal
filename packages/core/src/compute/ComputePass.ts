import { ComputeShaderError } from "./ComputeShaderError";
import { ComputeShader } from "./ComputeShader";
import type { ComputeProfiler } from "./ComputeProfiler";

/**
 * Options for creating a ComputePass.
 */
export interface ComputePassOptions {
  /** The compute shader to execute */
  shader: ComputeShader;
  /** Optional label for debugging */
  label?: string;
  /** Optional profiler for timestamp queries */
  profiler?: ComputeProfiler;
}

/**
 * Manages compute pass execution including bind groups, dispatch, and command submission.
 * Supports multiple bind groups (@group(0), @group(1), etc.) and optional profiling.
 *
 * @example
 * ```ts
 * const pass = new ComputePass(device, { shader });
 * pass.setBindGroup(0, bindGroup0);
 * pass.setBindGroup(1, bindGroup1);
 * pass.dispatch(workgroupCountX, workgroupCountY, workgroupCountZ);
 * ```
 */
export class ComputePass {
  private _device: GPUDevice;
  private _shader: ComputeShader;
  private _bindGroups: Map<number, GPUBindGroup> = new Map();
  private _label?: string;
  private _profiler?: ComputeProfiler;

  /**
   * Creates a new ComputePass.
   *
   * @param device - The WebGPU device
   * @param options - Pass configuration options
   * @throws {ComputeShaderError} If device or shader is not provided
   */
  constructor(device: GPUDevice, options: ComputePassOptions) {
    if (!device) {
      throw new ComputeShaderError("GPUDevice is required");
    }
    if (!options.shader) {
      throw new ComputeShaderError("ComputeShader is required");
    }

    this._device = device;
    this._shader = options.shader;
    this._label = options.label;
    this._profiler = options.profiler;
  }

  /** The compute shader being executed */
  get shader(): ComputeShader {
    return this._shader;
  }

  /**
   * Sets a bind group for the compute pass.
   *
   * @param groupIndex - The bind group index (corresponds to @group(n) in shader)
   * @param bindGroup - The bind group to set
   * @returns This ComputePass instance for chaining
   */
  setBindGroup(groupIndex: number, bindGroup: GPUBindGroup): this {
    if (groupIndex < 0) {
      throw new ComputeShaderError(
        `Invalid bind group index: ${groupIndex}. Must be >= 0`,
      );
    }
    this._bindGroups.set(groupIndex, bindGroup);
    return this;
  }

  /**
   * Gets a previously set bind group.
   *
   * @param groupIndex - The bind group index
   * @returns The bind group, or undefined if not set
   */
  getBindGroup(groupIndex: number): GPUBindGroup | undefined {
    return this._bindGroups.get(groupIndex);
  }

  /**
   * Clears all bind groups.
   *
   * @returns This ComputePass instance for chaining
   */
  clearBindGroups(): this {
    this._bindGroups.clear();
    return this;
  }

  /**
   * Dispatches the compute shader with the specified workgroup counts.
   * Encodes and submits the compute pass to the GPU queue.
   *
   * @param workgroupCountX - Number of workgroups in X dimension
   * @param workgroupCountY - Number of workgroups in Y dimension (default: 1)
   * @param workgroupCountZ - Number of workgroups in Z dimension (default: 1)
   * @throws {ComputeShaderError} If no bind groups are set
   */
  dispatch(
    workgroupCountX: number,
    workgroupCountY = 1,
    workgroupCountZ = 1,
  ): void {
    if (this._bindGroups.size === 0) {
      throw new ComputeShaderError(
        "At least one bind group must be set before dispatch",
      );
    }

    const encoder = this._device.createCommandEncoder({
      label: this._label ? `${this._label} CommandEncoder` : undefined,
    });

    // Create compute pass with optional timestamp writes
    const passEncoder = encoder.beginComputePass({
      label: this._label ? `${this._label} ComputePass` : undefined,
      timestampWrites: this._profiler?.getTimestampWrites(),
    });

    const pipeline = this._shader.getPipeline();
    passEncoder.setPipeline(pipeline);

    // Set all bind groups in order
    for (const [index, bindGroup] of this._bindGroups) {
      passEncoder.setBindGroup(index, bindGroup);
    }

    passEncoder.dispatchWorkgroups(
      workgroupCountX,
      workgroupCountY,
      workgroupCountZ,
    );

    passEncoder.end();

    // Resolve timestamp queries if profiler is attached
    this._profiler?.resolve(encoder);

    this._device.queue.submit([encoder.finish()]);
  }

  /**
   * Dispatches the compute shader and waits for completion.
   * Useful when you need to ensure the GPU work is done before continuing.
   *
   * @param workgroupCountX - Number of workgroups in X dimension
   * @param workgroupCountY - Number of workgroups in Y dimension (default: 1)
   * @param workgroupCountZ - Number of workgroups in Z dimension (default: 1)
   * @returns Promise that resolves when the GPU work is complete
   */
  async dispatchAsync(
    workgroupCountX: number,
    workgroupCountY = 1,
    workgroupCountZ = 1,
  ): Promise<void> {
    this.dispatch(workgroupCountX, workgroupCountY, workgroupCountZ);
    await this._device.queue.onSubmittedWorkDone();
  }
}
