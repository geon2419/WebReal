/**
 * Cache for compute pipelines using WeakMap to allow garbage collection
 * when devices are destroyed.
 *
 * Pipelines are cached by shader code hash to avoid redundant compilation.
 */
export class ComputePipelineCache {
  private static _cache = new WeakMap<
    GPUDevice,
    Map<string, GPUComputePipeline>
  >();

  /**
   * Generates a simple hash from shader code for cache key.
   * Uses djb2a (XOR variant of djb2) algorithm for fast string hashing.
   * @param str - The input string (shader code)
   * @returns The hash code as a base36 string
   */
  private static _hashCode(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  /**
   * Gets or creates a compute pipeline for the given shader code.
   *
   * @param device - The WebGPU device
   * @param shaderCode - WGSL compute shader source code
   * @param layout - Pipeline layout (optional, defaults to "auto")
   * @param label - Optional label for debugging
   * @returns The cached or newly created compute pipeline
   */
  static getOrCreate(
    device: GPUDevice,
    shaderCode: string,
    layout: GPUPipelineLayout | "auto" = "auto",
    label?: string,
    entryPoint: string = "main"
  ): GPUComputePipeline {
    // Short-term safety: do not cache pipelines created with explicit layouts.
    if (layout !== "auto") {
      const shaderModule = device.createShaderModule({
        label: label ? `${label} ShaderModule` : undefined,
        code: shaderCode,
      });

      return device.createComputePipeline({
        label: label ? `${label} Pipeline` : undefined,
        layout,
        compute: {
          module: shaderModule,
          entryPoint,
        },
      });
    }

    let deviceCache = this._cache.get(device);
    if (!deviceCache) {
      deviceCache = new Map();
      this._cache.set(device, deviceCache);
    }

    // Cache key must include entryPoint: the same WGSL module can expose
    // multiple entry points, and using the wrong one would produce an invalid
    // pipeline for the caller.
    const cacheKey = `${this._hashCode(shaderCode)}:${entryPoint}`;
    let pipeline = deviceCache.get(cacheKey);

    if (!pipeline) {
      const shaderModule = device.createShaderModule({
        label: label ? `${label} ShaderModule` : undefined,
        code: shaderCode,
      });

      pipeline = device.createComputePipeline({
        label: label ? `${label} Pipeline` : undefined,
        layout,
        compute: {
          module: shaderModule,
          entryPoint,
        },
      });

      deviceCache.set(cacheKey, pipeline);
    }

    return pipeline;
  }

  /**
   * Checks if a pipeline for the given shader code exists in cache.
   *
   * @param device - The WebGPU device
   * @param shaderCode - WGSL compute shader source code
   * @returns True if an "auto"-layout pipeline is cached
   */
  static has(
    device: GPUDevice,
    shaderCode: string,
    entryPoint: string = "main"
  ): boolean {
    const deviceCache = this._cache.get(device);
    if (!deviceCache) return false;

    const cacheKey = `${this._hashCode(shaderCode)}:${entryPoint}`;
    return deviceCache.has(cacheKey);
  }

  /**
   * Clears all cached pipelines for a specific device.
   *
   * @param device - The WebGPU device
   */
  static clear(device: GPUDevice): void {
    this._cache.delete(device);
  }

  /**
   * Gets the hash code for a shader string (exposed for testing).
   * @internal
   * @param str - The input string (shader code)
   * @returns The hash code as a base36 string
   */
  static getHashCode(str: string): string {
    return this._hashCode(str);
  }
}
