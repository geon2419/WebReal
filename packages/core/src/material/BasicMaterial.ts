import type { Material, VertexBufferLayout } from "./Material";

export interface BasicMaterialOptions {
  color?: [number, number, number];
}

export class BasicMaterial implements Material {
  readonly type = "basic";
  /** RGB color (0-1 range) */
  readonly color: [number, number, number];

  constructor(options: BasicMaterialOptions = {}) {
    this.color = options.color ?? [1.0, 1.0, 1.0];
  }

  getVertexShader(): string {
    return /* wgsl */ `
struct Uniforms {
  mvpMatrix: mat4x4f,
  color: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.mvpMatrix * vec4f(input.position, 1.0);
  output.normal = input.normal;
  return output;
}
`;
  }

  getFragmentShader(): string {
    return /* wgsl */ `
struct Uniforms {
  mvpMatrix: mat4x4f,
  color: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  @location(0) normal: vec3f,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  return uniforms.color;
}
`;
  }

  getVertexBufferLayout(): VertexBufferLayout {
    return {
      // position(vec3f) + normal(vec3f) = 6 floats × 4 bytes = 24 bytes
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
  }

  // Layout: mat4x4f (64 bytes) + vec4f color (16 bytes) = 80 bytes
  getUniformBufferSize(): number {
    return 80;
  }

  /**
   * Writes material-specific uniform data (color) to the buffer.
   * MVP matrix should be written separately at offset 0.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64, after MVP matrix)
   */
  writeUniformData(buffer: DataView, offset: number = 64): void {
    buffer.setFloat32(offset, this.color[0], true);
    buffer.setFloat32(offset + 4, this.color[1], true);
    buffer.setFloat32(offset + 8, this.color[2], true);
    buffer.setFloat32(offset + 12, 1.0, true); // alpha
  }
}
