import type { Material, VertexBufferLayout } from "./Material";

/**
 * Configuration options for creating a ShaderMaterial.
 *
 * Custom shaders must follow these conventions:
 * - Vertex shader entry point: `@vertex fn main(...)`
 * - Fragment shader entry point: `@fragment fn main(...)`
 * - Uniform buffer binding: `@group(0) @binding(0) var<uniform> uniforms: Uniforms;`
 * - First field in Uniforms struct: `mvpMatrix: mat4x4f` (64 bytes at offset 0)
 *   - Written by Renderer as P*V*M (local -> clip)
 * - (Optional) InstancedMesh storage binding: `@group(2) @binding(0) var<storage, read> instances: ...`
 */
export interface ShaderMaterialOptions {
  vertexShader: string;
  fragmentShader: string;
  vertexBufferLayout?: VertexBufferLayout;
  uniformBufferSize?: number;
  primitiveTopology?: GPUPrimitiveTopology;
  /**
   * Optional callback to write custom uniform data to the buffer.
   * The MVP matrix is written separately by the Renderer at offset 0.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64, after MVP matrix)
   */
  writeUniformData?: (buffer: DataView, offset?: number) => void;
}

/**
 * Generates a hash from shader code for material type identification.
 * @param vertex - The vertex shader source code
 * @param fragment - The fragment shader source code
 * @returns A hash string used as material type identifier
 */
function hashShaderCode(vertex: string, fragment: string): string {
  const combined = vertex + fragment;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Material that uses custom WGSL shaders for rendering.
 *
 * @example
 * ```ts
 * const material = new ShaderMaterial({
 *   vertexShader: `WGSL vertex shader`,
 *   fragmentShader: `WGSL fragment shader`,
 *   uniformBufferSize: 80, // MVP (64) + color (16)
 *   writeUniformData: (buffer, offset = 64) => {
 *     buffer.setFloat32(offset, 1.0, true);     // red
 *     buffer.setFloat32(offset + 4, 0.0, true); // green
 *   }
 * });
 * ```
 */
export class ShaderMaterial implements Material {
  readonly type: string;

  private _vertexShader: string;
  private _fragmentShader: string;
  private _vertexBufferLayout: VertexBufferLayout;
  private _uniformBufferSize: number;
  private _primitiveTopology: GPUPrimitiveTopology;
  private _writeUniformDataCallback?: (
    buffer: DataView,
    offset?: number
  ) => void;
  private _uniformDataBuffer: ArrayBuffer;

  /**
   * Creates a new ShaderMaterial instance.
   * @param options - Configuration options for the material
   */
  constructor(options: ShaderMaterialOptions) {
    // Generate type based on shader code hash for consistent pipeline caching
    // Same shader code = same type = shared pipeline (even across HMR)
    const hash = hashShaderCode(options.vertexShader, options.fragmentShader);
    this.type = `shader_${hash}`;

    this._vertexShader = options.vertexShader;
    this._fragmentShader = options.fragmentShader;

    this._vertexBufferLayout = options.vertexBufferLayout ?? {
      arrayStride: 24,
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3", // position
        },
        {
          shaderLocation: 1,
          offset: 12,
          format: "float32x3", // normal
        },
      ],
    };

    // Default uniform buffer size: MVP (64) + color (16) = 80 bytes
    this._uniformBufferSize = options.uniformBufferSize ?? 80;
    if (this._uniformBufferSize < 64) {
      throw new Error(
        `ShaderMaterial uniformBufferSize must be at least 64 bytes for the MVP matrix. Got: ${this._uniformBufferSize}`
      );
    }

    this._primitiveTopology = options.primitiveTopology ?? "triangle-list";
    this._writeUniformDataCallback = options.writeUniformData;

    // Pre-allocate uniform buffer to reduce GC pressure during rendering
    this._uniformDataBuffer = new ArrayBuffer(this._uniformBufferSize);
  }

  /**
   * Gets the vertex shader source code.
   * @returns The WGSL vertex shader string
   */
  getVertexShader(): string {
    return this._vertexShader;
  }

  /**
   * Gets the fragment shader source code.
   * @returns The WGSL fragment shader string
   */
  getFragmentShader(): string {
    return this._fragmentShader;
  }

  /**
   * Gets the vertex buffer layout configuration.
   * @returns The vertex buffer layout describing attribute locations and formats
   */
  getVertexBufferLayout(): VertexBufferLayout {
    return this._vertexBufferLayout;
  }

  /**
   * Gets the size of the uniform buffer in bytes.
   * @returns The uniform buffer size (minimum 64 bytes for MVP matrix)
   */
  getUniformBufferSize(): number {
    return this._uniformBufferSize;
  }

  /**
   * Gets the primitive topology for rendering.
   * @returns The GPU primitive topology type
   */
  getPrimitiveTopology(): GPUPrimitiveTopology {
    return this._primitiveTopology;
  }

  /**
   * Gets the pre-allocated uniform data buffer.
   * This buffer is reused across frames to reduce GC pressure.
   * @returns The ArrayBuffer for uniform data
   */
  getUniformDataBuffer(): ArrayBuffer {
    return this._uniformDataBuffer;
  }

  /**
   * Writes custom uniform data to the buffer using the user-provided callback.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64, after MVP matrix)
   */
  writeUniformData(buffer: DataView, offset: number = 64): void {
    if (this._writeUniformDataCallback) {
      this._writeUniformDataCallback(buffer, offset);
    }
  }
}
