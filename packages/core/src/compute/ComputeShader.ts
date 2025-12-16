import { ComputeShaderError } from "./ComputeShaderError";
import { ComputePipelineCache } from "./ComputePipelineCache";

/**
 * Options for creating a ComputeShader.
 */
export interface ComputeShaderOptions {
  /** WGSL compute shader source code */
  code: string;
  /** Entry point function name (default: "main") */
  entryPoint?: string;
  /**
   * Explicit bind group layout descriptors.
   * If not provided, uses "auto" layout.
   * Array index corresponds to @group(n) in the shader.
   */
  bindGroupLayouts?: GPUBindGroupLayoutDescriptor[];
  /** Optional label for debugging */
  label?: string;
  /** Whether to use pipeline caching (default: true) */
  useCache?: boolean;
}

/**
 * A compute shader wrapper that manages pipeline creation and bind group layouts.
 * Supports both automatic and explicit bind group layouts for flexibility.
 *
 * @example
 * ```ts
 * // Simple usage with auto layout
 * const shader = new ComputeShader(device, {
 *   code: `
 *     @group(0) @binding(0) var<storage, read_write> data: array<f32>;
 *     @compute @workgroup_size(64)
 *     fn main(@builtin(global_invocation_id) id: vec3u) {
 *       data[id.x] *= 2.0;
 *     }
 *   `,
 * });
 *
 * // Advanced usage with explicit layouts
 * const shader = new ComputeShader(device, {
 *   code: shaderCode,
 *   bindGroupLayouts: [
 *     { entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }] },
 *   ],
 * });
 * ```
 */
export class ComputeShader {
  private _device: GPUDevice;
  private _code: string;
  private _entryPoint: string;
  private _pipeline: GPUComputePipeline | null = null;
  private _pipelineLayout: GPUPipelineLayout | null = null;
  private _bindGroupLayouts: GPUBindGroupLayout[] = [];
  private _label?: string;
  private _useCache: boolean;

  /**
   * Creates a new ComputeShader.
   *
   * @param device - The WebGPU device
   * @param options - Shader configuration options
   * @throws {ComputeShaderError} If device is not provided or shader code is empty
   */
  constructor(device: GPUDevice, options: ComputeShaderOptions) {
    if (!device) {
      throw new ComputeShaderError("GPUDevice is required");
    }
    if (!options.code || options.code.trim().length === 0) {
      throw new ComputeShaderError("Shader code is required");
    }

    this._device = device;
    this._code = options.code;
    this._entryPoint = options.entryPoint ?? "main";
    this._label = options.label;
    this._useCache = options.useCache ?? true;

    // Create explicit bind group layouts if provided
    if (options.bindGroupLayouts && options.bindGroupLayouts.length > 0) {
      this._bindGroupLayouts = options.bindGroupLayouts.map(
        (descriptor, index) =>
          device.createBindGroupLayout({
            label: this._label
              ? `${this._label} BindGroupLayout ${index}`
              : undefined,
            ...descriptor,
          })
      );

      this._pipelineLayout = device.createPipelineLayout({
        label: this._label ? `${this._label} PipelineLayout` : undefined,
        bindGroupLayouts: this._bindGroupLayouts,
      });
    }
  }

  /** The WGSL shader source code */
  get code(): string {
    return this._code;
  }

  /** The entry point function name */
  get entryPoint(): string {
    return this._entryPoint;
  }

  /** Whether explicit bind group layouts are used */
  get hasExplicitLayout(): boolean {
    return this._pipelineLayout !== null;
  }

  /**
   * Gets the bind group layout for a specific group index.
   * Only available when using explicit layouts.
   *
   * @param groupIndex - The bind group index (corresponds to @group(n))
   * @returns The bind group layout, or undefined for auto layout
   */
  getBindGroupLayout(groupIndex: number): GPUBindGroupLayout | undefined {
    if (this._bindGroupLayouts.length > 0) {
      return this._bindGroupLayouts[groupIndex];
    }
    // For auto layout, get from pipeline after it's created
    const pipeline = this.getPipeline();
    return pipeline.getBindGroupLayout(groupIndex);
  }

  /**
   * Gets or creates the compute pipeline.
   * Uses caching by default to avoid redundant compilation.
   *
   * @returns The compute pipeline
   */
  getPipeline(): GPUComputePipeline {
    if (this._pipeline) {
      return this._pipeline;
    }

    const layout = this._pipelineLayout ?? "auto";

    if (this._useCache && !this._pipelineLayout) {
      // Cache only auto layout; explicit layouts aren't cached.
      // Cache key doesn't include bind group layout config, so reuse could be incorrect.
      this._pipeline = ComputePipelineCache.getOrCreate(
        this._device,
        this._code,
        layout,
        this._label,
        this._entryPoint
      );
    } else {
      // Create pipeline directly for explicit layouts or when caching disabled
      const shaderModule = this._device.createShaderModule({
        label: this._label ? `${this._label} ShaderModule` : undefined,
        code: this._code,
      });

      this._pipeline = this._device.createComputePipeline({
        label: this._label ? `${this._label} Pipeline` : undefined,
        layout,
        compute: {
          module: shaderModule,
          entryPoint: this._entryPoint,
        },
      });
    }

    return this._pipeline;
  }

  /**
   * Creates a bind group for this shader.
   *
   * @param groupIndex - The bind group index (corresponds to @group(n))
   * @param entries - The bind group entries
   * @param label - Optional label for debugging
   * @returns The created bind group
   */
  createBindGroup(
    groupIndex: number,
    entries: GPUBindGroupEntry[],
    label?: string
  ): GPUBindGroup {
    const layout = this.getBindGroupLayout(groupIndex);
    if (!layout) {
      throw new ComputeShaderError(
        `No bind group layout available for group ${groupIndex}`
      );
    }

    return this._device.createBindGroup({
      label:
        label ??
        (this._label ? `${this._label} BindGroup ${groupIndex}` : undefined),
      layout,
      entries,
    });
  }
}
