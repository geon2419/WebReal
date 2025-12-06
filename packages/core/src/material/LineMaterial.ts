import { Color } from "@web-real/math";
import type { Material, VertexBufferLayout } from "./Material";
import { ShaderLib } from "../shaders";

export interface LineMaterialOptions {
  color?: [number, number, number] | Color;
}

/**
 * Material for rendering lines with a single color.
 * Uses "line-list" primitive topology.
 */
export class LineMaterial implements Material {
  readonly type = "line";
  /** Color with RGBA components (Color instance, 0-1 range) */
  readonly color: Color;

  constructor(options: LineMaterialOptions = {}) {
    this.color = options.color
      ? Color.from(options.color)
      : new Color(1.0, 1.0, 1.0);
  }

  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  getVertexBufferLayout(): VertexBufferLayout {
    return {
      // position(vec3f) = 3 floats × 4 bytes = 12 bytes
      arrayStride: 12,
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3", // position
        },
      ],
    };
  }

  // Layout: mat4x4f (64 bytes) + vec4f color (16 bytes) = 80 bytes
  getUniformBufferSize(): number {
    return 80;
  }

  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "line-list";
  }

  /**
   * Writes material-specific uniform data (color) to the buffer.
   * MVP matrix should be written separately at offset 0.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64, after MVP matrix)
   */
  writeUniformData(buffer: DataView, offset: number = 64): void {
    buffer.setFloat32(offset, this.color.r, true);
    buffer.setFloat32(offset + 4, this.color.g, true);
    buffer.setFloat32(offset + 8, this.color.b, true);
    buffer.setFloat32(offset + 12, this.color.a, true);
  }
}
