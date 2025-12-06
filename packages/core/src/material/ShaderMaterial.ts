import type { Material, VertexBufferLayout } from "./Material";

/**
 * Options for creating a ShaderMaterial.
 *
 * IMPORTANT: Custom shaders must follow these conventions:
 * - Vertex shader entry point: `@vertex fn main(...)`
 * - Fragment shader entry point: `@fragment fn main(...)`
 * - Uniform buffer binding: `@group(0) @binding(0) var<uniform> uniforms: Uniforms;`
 * - The first field in the Uniforms struct MUST be `mvpMatrix: mat4x4f` (64 bytes at offset 0)
 *   as the Renderer automatically writes the MVP matrix to this location.
 */
export interface ShaderMaterialOptions {
  vertexShader: string;
  fragmentShader: string;
  vertexBufferLayout?: VertexBufferLayout;
  uniformBufferSize?: number;
  primitiveTopology?: GPUPrimitiveTopology;
  /**
   * Optional callback to write custom uniform data to the buffer.
   * This callback is invoked before any GPU writes occur. The MVP matrix is written separately by the Renderer at offset 0 of the GPU buffer.
   * The callback receives a DataView of a local uniform buffer to prepare data that will be written to the GPU buffer starting at the specified offset.
   * @param buffer - DataView of a local uniform buffer for preparing data
   * @param offset - Byte offset where this data will be written in the GPU buffer (default: 64, after MVP matrix)
   */
  writeUniformData?: (buffer: DataView, offset: number) => void;
}

let shaderMaterialCounter = 0;

/**
 * Material that allows custom WGSL shaders to be provided directly.
 *
 * The Renderer automatically handles:
 * - MVP matrix writing at offset 0 (64 bytes)
 * - Pipeline caching based on auto-generated unique type
 *
 * User responsibilities:
 * - Provide valid WGSL shaders with correct entry points
 * - Ensure Uniforms struct starts with `mvpMatrix: mat4x4f`
 * - Implement `writeUniformData` callback for additional uniform data (optional)
 *
 * @example
 * ```typescript
 * const material = new ShaderMaterial({
 *   vertexShader: `
 *     struct Uniforms {
 *       mvpMatrix: mat4x4f,
 *       color: vec4f,
 *     }
 *     @group(0) @binding(0) var<uniform> uniforms: Uniforms;
 *
 *     @vertex
 *     fn main(@location(0) position: vec3f) -> @builtin(position) vec4f {
 *       return uniforms.mvpMatrix * vec4f(position, 1.0);
 *     }
 *   `,
 *   fragmentShader: `
 *     struct Uniforms {
 *       mvpMatrix: mat4x4f,
 *       color: vec4f,
 *     }
 *     @group(0) @binding(0) var<uniform> uniforms: Uniforms;
 *
 *     @fragment
 *     fn main() -> @location(0) vec4f {
 *       return uniforms.color;
 *     }
 *   `,
 *   uniformBufferSize: 80, // MVP (64) + color (16)
 *   writeUniformData: (buffer, offset) => {
 *     buffer.setFloat32(offset, 1.0, true);     // r
 *     buffer.setFloat32(offset + 4, 0.0, true); // g
 *     buffer.setFloat32(offset + 8, 0.0, true); // b
 *     buffer.setFloat32(offset + 12, 1.0, true); // a
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

  writeUniformData?: (buffer: DataView, offset: number) => void;

  constructor(options: ShaderMaterialOptions) {
    this.type = `shader_${shaderMaterialCounter++}`;

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

    this.writeUniformData = options.writeUniformData;
  }

  getVertexShader(): string {
    return this._vertexShader;
  }

  getFragmentShader(): string {
    return this._fragmentShader;
  }

  getVertexBufferLayout(): VertexBufferLayout {
    return this._vertexBufferLayout;
  }

  getUniformBufferSize(): number {
    return this._uniformBufferSize;
  }

  getPrimitiveTopology(): GPUPrimitiveTopology {
    return this._primitiveTopology;
  }
}
