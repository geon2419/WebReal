import type { Material } from "../material/Material";

/**
 * Caches render pipelines for materials to avoid rebuilding pipelines every frame.
 *
 * @example
 * ```ts
 * const pipelines = new PipelineCache({ device, format, sampleCount: 4 });
 * const pipeline = pipelines.getOrCreate(material);
 * ```
 */
export class PipelineCache {
  private _device: GPUDevice;
  private _format: GPUTextureFormat;
  private _sampleCount: number;
  private _pipelineCache: Map<string, GPURenderPipeline> = new Map();

  /**
   * Creates a new PipelineCache.
   * @param options - Construction options
   * @param options.device - The WebGPU device used to create pipelines
   * @param options.format - The color attachment format for pipeline targets
   * @param options.sampleCount - The MSAA sample count used by pipelines
   */
  constructor(options: {
    device: GPUDevice;
    format: GPUTextureFormat;
    sampleCount: number;
  }) {
    this._device = options.device;
    this._format = options.format;
    this._sampleCount = options.sampleCount;
  }

  /**
   * Returns a cached pipeline for the material, creating one if needed.
   * @param material - Material providing shaders, vertex layout, and topology
   * @returns A GPURenderPipeline configured for the given material
   */
  getOrCreate(material: Material): GPURenderPipeline {
    const topology = material.getPrimitiveTopology();
    const key = `${material.type}_${topology}`;

    const cached = this._pipelineCache.get(key);
    if (cached) return cached;

    const vertexShaderModule = this._device.createShaderModule({
      label: `${material.type} Vertex Shader`,
      code: material.getVertexShader(),
    });

    const fragmentShaderModule = this._device.createShaderModule({
      label: `${material.type} Fragment Shader`,
      code: material.getFragmentShader(),
    });

    const vertexBufferLayout = material.getVertexBufferLayout();

    const pipeline = this._device.createRenderPipeline({
      label: `${material.type} Pipeline`,
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: vertexBufferLayout.arrayStride,
            attributes: vertexBufferLayout.attributes,
          },
        ],
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "main",
        targets: [{ format: this._format }],
      },
      primitive: {
        topology,
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
      multisample: {
        count: this._sampleCount,
      },
    });

    this._pipelineCache.set(key, pipeline);
    return pipeline;
  }

  /**
   * Clears all cached pipelines.
   */
  clear(): void {
    this._pipelineCache.clear();
  }
}
