import type { Material, VertexBufferLayout } from "./Material";

const DEFAULT_FACE_COLORS: [number, number, number][] = [
  [1.0, 0.3, 0.3], // Front - Red
  [0.3, 1.0, 0.3], // Back - Green
  [0.3, 0.3, 1.0], // Top - Blue
  [1.0, 1.0, 0.3], // Bottom - Yellow
  [1.0, 0.3, 1.0], // Right - Magenta
  [0.3, 1.0, 1.0], // Left - Cyan
];

export interface VertexColorMaterialOptions {
  colors?: Float32Array;
  faceColors?: [number, number, number][];
  verticesPerFace?: number;
}

export class VertexColorMaterial implements Material {
  readonly type = "vertexColor";

  private _colors: Float32Array;

  constructor(options: VertexColorMaterialOptions = {}) {
    if (options.colors) {
      this._colors = options.colors;
    } else {
      const faceColors = options.faceColors ?? DEFAULT_FACE_COLORS;
      const verticesPerFace = options.verticesPerFace ?? 4;
      this._colors = this.expandFaceColors(faceColors, verticesPerFace);
    }
  }

  private expandFaceColors(
    faceColors: [number, number, number][],
    verticesPerFace: number
  ): Float32Array {
    const colors: number[] = [];
    for (const color of faceColors) {
      for (let i = 0; i < verticesPerFace; i++) {
        colors.push(...color);
      }
    }
    return new Float32Array(colors);
  }

  get colors(): Float32Array {
    return this._colors;
  }

  /**
   * Updates face colors and regenerates per-vertex colors.
   * @param faceColors - Array of RGB colors for each face
   * @param verticesPerFace - Number of vertices per face (default: 4)
   */
  setFaceColors(
    faceColors: [number, number, number][],
    verticesPerFace: number = 4
  ): void {
    this._colors = this.expandFaceColors(faceColors, verticesPerFace);
  }

  /**
   * Updates per-vertex colors directly.
   * @param colors - Float32Array of RGB values (3 floats per vertex)
   */
  setColors(colors: Float32Array): void {
    this._colors = colors;
  }

  getVertexShader(): string {
    return /* wgsl */ `
struct Uniforms {
  mvpMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) color: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.mvpMatrix * vec4f(input.position, 1.0);
  output.color = input.color;
  return output;
}
`;
  }

  getFragmentShader(): string {
    return /* wgsl */ `
struct FragmentInput {
  @location(0) color: vec3f,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  return vec4f(input.color, 1.0);
}
`;
  }

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

  // Only needs MVP matrix (64 bytes).
  getUniformBufferSize(): number {
    return 64;
  }
}
