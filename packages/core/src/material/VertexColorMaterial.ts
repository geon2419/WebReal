import { Color } from "@web-real/math";
import type { Material, VertexBufferLayout } from "./Material";
import { ShaderLib } from "../shaders";

const DEFAULT_FACE_COLORS: Color[] = [
  Color.fromHex("#ff4d4d"), // Front - Red
  Color.fromHex("#4dff4d"), // Back - Green
  Color.fromHex("#4d4dff"), // Top - Blue
  Color.fromHex("#ffff4d"), // Bottom - Yellow
  Color.fromHex("#ff4dff"), // Right - Magenta
  Color.fromHex("#4dffff"), // Left - Cyan
];

/**
 * Options for creating a VertexColorMaterial.
 */
export interface VertexColorMaterialOptions {
  colors?: Float32Array;
  faceColors?: Color[];
  verticesPerFace?: number;
}

/**
 * A material that renders geometry with per-vertex colors.
 *
 * @example
 * ```ts
 * // Using default colors
 * const material = new VertexColorMaterial();
 *
 * // Using custom face colors
 * const faceColors = [Color.red(), Color.green(), Color.blue()];
 * const material = new VertexColorMaterial({ faceColors, verticesPerFace: 4 });
 * ```
 */
export class VertexColorMaterial implements Material {
  readonly type = "vertexColor";

  private _colors: Float32Array;

  /**
   * Creates a new VertexColorMaterial instance.
   * @param options - Configuration options for colors (default: uses DEFAULT_FACE_COLORS)
   */
  constructor(options: VertexColorMaterialOptions = {}) {
    if (options.colors) {
      this._colors = options.colors;
    } else {
      const faceColors = options.faceColors ?? DEFAULT_FACE_COLORS;
      const verticesPerFace = options.verticesPerFace ?? 4;
      this._colors = this.expandFaceColors(faceColors, verticesPerFace);
    }
  }

  /**
   * Expands face colors to per-vertex colors by repeating each color.
   * @param faceColors - Array of colors, one per face
   * @param verticesPerFace - Number of vertices per face
   * @returns Float32Array of RGB values for all vertices
   */
  private expandFaceColors(
    faceColors: Color[],
    verticesPerFace: number,
  ): Float32Array {
    const colors: number[] = [];
    for (const color of faceColors) {
      for (let i = 0; i < verticesPerFace; i++) {
        colors.push(color.r, color.g, color.b);
      }
    }
    return new Float32Array(colors);
  }

  get colors(): Float32Array {
    return this._colors;
  }

  /**
   * Updates face colors and regenerates per-vertex colors.
   * @param faceColors - Array of Color objects for each face
   * @param verticesPerFace - Number of vertices per face (default: 4)
   */
  setFaceColors(faceColors: Color[], verticesPerFace: number = 4): void {
    this._colors = this.expandFaceColors(faceColors, verticesPerFace);
  }

  /**
   * Updates per-vertex colors directly.
   * @param colors - Float32Array of RGB values (3 floats per vertex)
   */
  setColors(colors: Float32Array): void {
    this._colors = colors;
  }

  /**
   * Returns the WGSL vertex shader code for vertex color rendering.
   * @returns The vertex shader source code
   */
  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  /**
   * Returns the WGSL fragment shader code for vertex color rendering.
   * @returns The fragment shader source code
   */
  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  /**
   * Returns the vertex buffer layout for position and color attributes.
   * @returns The vertex buffer layout with 24-byte stride
   */
  getVertexBufferLayout(): VertexBufferLayout {
    return {
      // position(vec3f) + color(vec3f) = 6 floats × 4 bytes = 24 bytes
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
          format: "float32x3", // color
        },
      ],
    };
  }

  /**
   * Returns the uniform buffer size for MVP matrix.
   * @returns The buffer size in bytes (64 bytes for mat4x4f)
   */
  getUniformBufferSize(): number {
    return 64;
  }

  /**
   * Returns the primitive topology for rendering.
   * @returns The topology type (triangle-list)
   */
  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }
}
