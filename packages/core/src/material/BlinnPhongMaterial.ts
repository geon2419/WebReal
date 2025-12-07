import { Color } from "@web-real/math";
import type { Material, VertexBufferLayout } from "./Material";
import { ShaderLib } from "../shaders";

export interface BlinnPhongMaterialOptions {
  color?: [number, number, number] | Color;
  shininess?: number;
  wireframe?: boolean;
}

export class BlinnPhongMaterial implements Material {
  readonly type = "blinnPhong";
  /** RGBA color (Color instance, 0-1 range) */
  readonly color: Color;
  /** Shininess exponent for specular highlight (higher = sharper) */
  shininess: number;
  /** Whether to render in wireframe mode */
  wireframe: boolean;

  constructor(options: BlinnPhongMaterialOptions = {}) {
    this.color = options.color
      ? Color.from(options.color)
      : new Color(1.0, 1.0, 1.0);
    this.shininess = options.shininess ?? 32.0;
    this.wireframe = options.wireframe ?? false;
  }

  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
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

  // Layout: mat4x4f mvp (64B) + mat4x4f model (64B) + mat4x4f normalMatrix (64B) + vec4f colorAndShininess (16B) + vec4f lightPosition (16B) + vec4f lightColor (16B) + vec4f cameraPosition (16B) + vec4f lightParams (16B) + vec4f lightTypes (16B) = 288 bytes
  getUniformBufferSize(): number {
    return 288;
  }

  getPrimitiveTopology(): GPUPrimitiveTopology {
    return this.wireframe ? "line-list" : "triangle-list";
  }

  /**
   * Writes material-specific uniform data (color + shininess) to the buffer.
   * MVP matrix should be written separately at offset 0.
   * Model matrix should be written at offset 64.
   * Normal matrix should be written at offset 128.
   * Light data should be written by the Renderer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 192, after MVP + Model + Normal matrices)
   */
  writeUniformData(buffer: DataView, offset: number = 128): void {
    buffer.setFloat32(offset, this.color.r, true);
    buffer.setFloat32(offset + 4, this.color.g, true);
    buffer.setFloat32(offset + 8, this.color.b, true);
    buffer.setFloat32(offset + 12, this.shininess, true);
  }
}
