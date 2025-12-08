import { Color } from "@web-real/math";
import type { Material, VertexBufferLayout, RenderContext } from "./Material";
import { ShaderLib } from "../shaders";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";
import type { Light } from "../light/Light";

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
   * Writes material-specific uniform data to the buffer.
   * Writes model matrix, normal matrix, color+shininess, light data, and camera position.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64, after MVP matrix)
   * @param context - Optional rendering context with camera, scene, and mesh information
   */
  writeUniformData(
    buffer: DataView,
    offset: number = 64,
    context?: RenderContext
  ): void {
    // Write model matrix at offset 64
    if (context?.mesh) {
      for (let i = 0; i < 16; i++) {
        buffer.setFloat32(
          offset + i * 4,
          context.mesh.worldMatrix.data[i],
          true
        );
      }
    }

    // Write normal matrix at offset 128 (inverse transpose of model matrix)
    if (context?.mesh) {
      const normalMatrix = context.mesh.worldMatrix.inverse().transpose();
      for (let i = 0; i < 16; i++) {
        buffer.setFloat32(offset + 64 + i * 4, normalMatrix.data[i], true);
      }
    }

    // Write colorAndShininess at offset 192 (rgb = color, a = shininess)
    buffer.setFloat32(offset + 128, this.color.r, true); // offset 192
    buffer.setFloat32(offset + 132, this.color.g, true); // offset 196
    buffer.setFloat32(offset + 136, this.color.b, true); // offset 200
    buffer.setFloat32(offset + 140, this.shininess, true); // offset 204

    // Find light from scene if context provided
    let light: Light | undefined;
    if (context?.scene) {
      context.scene.traverse((obj) => {
        if (
          (obj instanceof DirectionalLight || obj instanceof PointLight) &&
          !light
        ) {
          light = obj;
        }
      });
    }

    // Write light data: offset 208 (lightPosition), 224 (lightColor), 256 (lightParams), 272 (lightTypes)
    if (light) {
      if (light instanceof DirectionalLight) {
        // Directional light: xyz = direction
        buffer.setFloat32(offset + 144, light.direction.x, true); // offset 208
        buffer.setFloat32(offset + 148, light.direction.y, true); // offset 212
        buffer.setFloat32(offset + 152, light.direction.z, true); // offset 216
        buffer.setFloat32(offset + 156, 0, true); // offset 220 (w unused)

        // Light params: not used for directional light
        buffer.setFloat32(offset + 192, 0, true); // offset 256
        buffer.setFloat32(offset + 196, 0, true); // offset 260
        buffer.setFloat32(offset + 200, 0, true); // offset 264
        buffer.setFloat32(offset + 204, 0, true); // offset 268

        // Light types: x = 0 (directional), y = 0 (unused)
        buffer.setFloat32(offset + 208, 0, true); // offset 272
        buffer.setFloat32(offset + 212, 0, true); // offset 276
        buffer.setFloat32(offset + 216, 0, true); // offset 280
        buffer.setFloat32(offset + 220, 0, true); // offset 284
      } else if (light instanceof PointLight) {
        // Point light: xyz = world position
        light.updateWorldMatrix(true, false);
        buffer.setFloat32(offset + 144, light.worldMatrix.data[12], true); // offset 208
        buffer.setFloat32(offset + 148, light.worldMatrix.data[13], true); // offset 212
        buffer.setFloat32(offset + 152, light.worldMatrix.data[14], true); // offset 216
        buffer.setFloat32(offset + 156, 0, true); // offset 220 (w unused)

        // Light params: x = range, y = attenuation param
        const attenuationFactors = light.getAttenuationFactors();
        buffer.setFloat32(offset + 192, attenuationFactors[0], true); // offset 256 (range)
        buffer.setFloat32(offset + 196, attenuationFactors[1], true); // offset 260 (param)
        buffer.setFloat32(offset + 200, 0, true); // offset 264
        buffer.setFloat32(offset + 204, 0, true); // offset 268

        // Light types: x = 1 (point), y = attenuation type
        buffer.setFloat32(offset + 208, 1, true); // offset 272 (light type: point)
        buffer.setFloat32(offset + 212, attenuationFactors[3], true); // offset 276 (attenuation type)
        buffer.setFloat32(offset + 216, 0, true); // offset 280
        buffer.setFloat32(offset + 220, 0, true); // offset 284
      }

      // Light color (common for all light types)
      buffer.setFloat32(offset + 160, light.color.r, true); // offset 224
      buffer.setFloat32(offset + 164, light.color.g, true); // offset 228
      buffer.setFloat32(offset + 168, light.color.b, true); // offset 232
      buffer.setFloat32(offset + 172, light.intensity, true); // offset 236
    } else {
      // Default light if none in scene (directional from above)
      buffer.setFloat32(offset + 144, 0, true); // offset 208
      buffer.setFloat32(offset + 148, -1, true); // offset 212
      buffer.setFloat32(offset + 152, 0, true); // offset 216
      buffer.setFloat32(offset + 156, 0, true); // offset 220

      buffer.setFloat32(offset + 160, 1, true); // offset 224 (r)
      buffer.setFloat32(offset + 164, 1, true); // offset 228 (g)
      buffer.setFloat32(offset + 168, 1, true); // offset 232 (b)
      buffer.setFloat32(offset + 172, 1, true); // offset 236 (intensity)

      buffer.setFloat32(offset + 192, 0, true); // offset 256
      buffer.setFloat32(offset + 196, 0, true); // offset 260
      buffer.setFloat32(offset + 200, 0, true); // offset 264
      buffer.setFloat32(offset + 204, 0, true); // offset 268

      buffer.setFloat32(offset + 208, 0, true); // offset 272 (directional)
      buffer.setFloat32(offset + 212, 0, true); // offset 276
      buffer.setFloat32(offset + 216, 0, true); // offset 280
      buffer.setFloat32(offset + 220, 0, true); // offset 284
    }

    // Write camera position at offset 240
    if (context?.camera) {
      const cameraWorldMatrix = context.camera.worldMatrix.data;
      buffer.setFloat32(offset + 176, cameraWorldMatrix[12], true); // offset 240
      buffer.setFloat32(offset + 180, cameraWorldMatrix[13], true); // offset 244
      buffer.setFloat32(offset + 184, cameraWorldMatrix[14], true); // offset 248
      buffer.setFloat32(offset + 188, 0, true); // offset 252 (w unused)
    }
  }
}
