import { Color } from "@web-real/math";
import type { Material, VertexBufferLayout, RenderContext } from "./Material";
import { ShaderLib } from "../shaders";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";
import type { Texture } from "../texture";
import { DummyTextures } from "../texture";

export interface BlinnPhongMaterialOptions {
  color?: [number, number, number] | Color;
  shininess?: number;
  wireframe?: boolean;
  displacementMap?: Texture;
  displacementScale?: number;
  displacementBias?: number;
  normalMap?: Texture;
  normalScale?: number;
}

export class BlinnPhongMaterial implements Material {
  readonly type = "blinnPhong";
  private _color: Color;
  private _shininess: number;
  wireframe: boolean;
  readonly displacementMap?: Texture;
  private _displacementScale: number;
  private _displacementBias: number;
  readonly normalMap?: Texture;
  private _normalScale: number;

  get color(): Color {
    return this._color;
  }

  get shininess(): number {
    return this._shininess;
  }

  get normalScale(): number {
    return this._normalScale;
  }

  get displacementScale(): number {
    return this._displacementScale;
  }

  get displacementBias(): number {
    return this._displacementBias;
  }

  constructor(options: BlinnPhongMaterialOptions = {}) {
    this._color = options.color
      ? Color.from(options.color)
      : new Color(1.0, 1.0, 1.0);
    this._shininess = options.shininess ?? 32.0;
    this.wireframe = options.wireframe ?? false;
    this.displacementMap = options.displacementMap;
    this._displacementScale = options.displacementScale ?? 1.0;
    this._displacementBias = options.displacementBias ?? 0.0;
    this.normalMap = options.normalMap;
    this._normalScale = options.normalScale ?? 1.0;
  }

  /**
   * Sets the material color.
   * @param color - Color instance or RGB array [r, g, b]
   */
  setColor(color: Color | [number, number, number]): void {
    this._color = Color.from(color);
  }

  /**
   * Sets the shininess exponent for specular highlights.
   * @param value - Shininess value (1-256)
   * @throws Error if value is out of range
   */
  setShininess(value: number): void {
    if (value < 1 || value > 256) {
      throw new Error("Shininess must be between 1 and 256");
    }
    this._shininess = value;
  }

  /**
   * Sets the normal map intensity multiplier.
   * @param value - Normal scale value (0-3)
   * @throws Error if value is out of range
   */
  setNormalScale(value: number): void {
    if (value < 0 || value > 3) {
      throw new Error("Normal scale must be between 0 and 3");
    }
    this._normalScale = value;
  }

  /**
   * Sets the displacement map scale multiplier.
   * @param value - Displacement scale value (0-10)
   * @throws Error if value is out of range
   */
  setDisplacementScale(value: number): void {
    if (value < 0 || value > 10) {
      throw new Error("Displacement scale must be between 0 and 10");
    }
    this._displacementScale = value;
  }

  /**
   * Sets the displacement map bias offset.
   * @param value - Displacement bias value (-1 to 1)
   * @throws Error if value is out of range
   */
  setDisplacementBias(value: number): void {
    if (value < -1 || value > 1) {
      throw new Error("Displacement bias must be between -1 and 1");
    }
    this._displacementBias = value;
  }

  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  getVertexBufferLayout(): VertexBufferLayout {
    return {
      // position(vec3f) + normal(vec3f) + uv(vec2f) + tangent(vec3f) + bitangent(vec3f) = 14 floats × 4 bytes = 56 bytes
      arrayStride: 56,
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
        {
          shaderLocation: 3,
          offset: 32,
          format: "float32x3", // tangent
        },
        {
          shaderLocation: 4,
          offset: 44,
          format: "float32x3", // bitangent
        },
      ],
    };
  }

  // Layout: mat4x4f mvp (64B) + mat4x4f model (64B) + mat4x4f normalMatrix (64B) + vec4f colorAndShininess (16B) + vec4f lightPosition (16B) + vec4f lightColor (16B) + vec4f cameraPosition (16B) + vec4f lightParams (16B) + vec4f lightTypes (16B) + vec4f displacementParams (16B) = 304 bytes
  getUniformBufferSize(): number {
    return 304;
  }

  /**
   * Gets textures for binding. Returns [displacementMap, normalMap] with dummy fallbacks.
   * @param device - WebGPU device for creating dummy textures if needed
   * @returns Array with [displacement texture, normal texture]
   */
  getTextures(device?: GPUDevice): Texture[] {
    if (!device) {
      throw new Error(
        "BlinnPhongMaterial.getTextures() requires a GPUDevice parameter"
      );
    }
    const displacementTex =
      this.displacementMap ?? DummyTextures.getBlack(device);
    const normalTex = this.normalMap ?? DummyTextures.getNormal(device);
    return [displacementTex, normalTex];
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

    // Get first light from context (pre-collected by Renderer)
    const light = context?.lights?.[0];

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

    // Write displacement params at offset 288 (vec4f: x=scale, y=bias, z=normalScale, w=unused)
    buffer.setFloat32(offset + 224, this.displacementScale, true); // offset 288
    buffer.setFloat32(offset + 228, this.displacementBias, true); // offset 292
    buffer.setFloat32(offset + 232, this.normalScale, true); // offset 296 (normalScale)
    buffer.setFloat32(offset + 236, 0, true); // offset 300 (unused)
  }
}
