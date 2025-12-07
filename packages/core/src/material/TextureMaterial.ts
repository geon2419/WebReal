import type { Material, VertexBufferLayout } from "./Material";
import { ShaderLib } from "../shaders";
import type { Texture } from "../Texture";

export interface TextureMaterialOptions {
  texture: Texture;
}

/**
 * A material that renders with a texture map.
 * Requires geometry with UV coordinates.
 */
export class TextureMaterial implements Material {
  readonly type = "texture";
  readonly texture: Texture;

  constructor(options: TextureMaterialOptions) {
    this.texture = options.texture;
  }

  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  getVertexBufferLayout(): VertexBufferLayout {
    return {
      // position(vec3f) + normal(vec3f) + uv(vec2f) = 8 floats × 4 bytes = 32 bytes
      arrayStride: 32,
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
        {
          shaderLocation: 2,
          offset: 24,
          format: "float32x2", // uv
        },
      ],
    };
  }

  // Layout: mat4x4f mvp (64B) = 64 bytes
  getUniformBufferSize(): number {
    return 64;
  }

  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }

  getTexture(): Texture {
    return this.texture;
  }

  getTextures(): Texture[] {
    return [this.texture];
  }
}
