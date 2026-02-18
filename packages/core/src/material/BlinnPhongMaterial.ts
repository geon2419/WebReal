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

/**
 * Blinn-Phong material with support for displacement and normal mapping.
 *
 * @example
 * ```ts
 * const material = new BlinnPhongMaterial({
 *   color: [1.0, 0.5, 0.2],
 *   shininess: 64,
 *   normalMap: myNormalTexture
 * });
 * ```
 */
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

  /**
   * Creates a new BlinnPhongMaterial instance.
   * @param options - Material configuration options
   */
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
   * @param color - Color instance or RGB array
   */
  setColor(color: Color | [number, number, number]): void {
    this._color = Color.from(color);
  }

  /**
   * Sets the shininess exponent for specular highlights.
   * @param value - Shininess value (must be between 1 and 256)
   */
  setShininess(value: number): void {
    if (value < 1 || value > 256) {
      throw new Error("Shininess must be between 1 and 256");
    }
    this._shininess = value;
  }

  /**
   * Sets the normal map intensity multiplier.
   * @param value - Normal scale value (must be between 0 and 3)
   */
  setNormalScale(value: number): void {
    if (value < 0 || value > 3) {
      throw new Error("Normal scale must be between 0 and 3");
    }
    this._normalScale = value;
  }

  /**
   * Sets the displacement map scale multiplier.
   * @param value - Displacement scale value (must be between 0 and 10)
   */
  setDisplacementScale(value: number): void {
    if (value < 0 || value > 10) {
      throw new Error("Displacement scale must be between 0 and 10");
    }
    this._displacementScale = value;
  }

  /**
   * Sets the displacement map bias offset.
   * @param value - Displacement bias value (must be between -1 and 1)
   */
  setDisplacementBias(value: number): void {
    if (value < -1 || value > 1) {
      throw new Error("Displacement bias must be between -1 and 1");
    }
    this._displacementBias = value;
  }

  /**
   * Gets the WGSL vertex shader code for this material.
   * @returns The vertex shader source code
   */
  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  /**
   * Gets the WGSL fragment shader code for this material.
   * @returns The fragment shader source code
   */
  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  /**
   * Gets the vertex buffer layout for this material.
   * @returns Layout with position, normal, UV, tangent, and bitangent attributes
   */
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

  /**
   * Gets the uniform buffer size required for this material.
   * @returns Size in bytes (304 bytes total)
   */
  getUniformBufferSize(): number {
    return 304;
  }

  /**
   * Gets textures for binding with dummy fallbacks if not set.
   * @param device - WebGPU device for creating dummy textures
   * @returns Array containing displacement and normal textures
   */
  getTextures(device?: GPUDevice): Texture[] {
    if (!device) {
      throw new Error(
        "BlinnPhongMaterial.getTextures() requires a GPUDevice parameter",
      );
    }
    const displacementTex =
      this.displacementMap ?? DummyTextures.getBlack(device);
    const normalTex = this.normalMap ?? DummyTextures.getNormal(device);
    return [displacementTex, normalTex];
  }

  /**
   * Gets the primitive topology for rendering.
   * @returns Line-list for wireframe mode, triangle-list otherwise
   */
  getPrimitiveTopology(): GPUPrimitiveTopology {
    return this.wireframe ? "line-list" : "triangle-list";
  }

  /**
   * Writes material uniforms to the GPU buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64). This represents the absolute position
   *                 where modelMatrix begins. All subsequent writes use relative offsets from this parameter.
   * @param context - Rendering context with camera, scene, and mesh data
   */
  writeUniformData(
    buffer: DataView,
    offset: number = 64,
    context?: RenderContext,
  ): void {
    this._writeModelMatrix(buffer, offset, context);
    this._writeNormalMatrix(buffer, offset, context);
    this._writeColorAndShininess(buffer, offset);

    const light = context?.lights?.[0];
    if (!light) {
      this._writeDefaultLight(buffer, offset);
    } else if (light instanceof DirectionalLight) {
      this._writeDirectionalLight(buffer, offset, light);
    } else if (light instanceof PointLight) {
      this._writePointLight(buffer, offset, light);
    }

    this._writeCameraPosition(buffer, offset, context);
    this._writeDisplacementParams(buffer, offset);
  }

  /**
   * Writes model matrix to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (modelMatrix at offset+0)
   * @param context - Rendering context
   */
  private _writeModelMatrix(
    buffer: DataView,
    offset: number,
    context?: RenderContext,
  ): void {
    if (!context?.mesh) return;

    for (let i = 0; i < 16; i++) {
      buffer.setFloat32(offset + i * 4, context.mesh.worldMatrix.data[i], true);
    }
  }

  /**
   * Writes normal matrix (inverse transpose of model matrix) to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (normalMatrix at offset+64)
   * @param context - Rendering context
   */
  private _writeNormalMatrix(
    buffer: DataView,
    offset: number,
    context?: RenderContext,
  ): void {
    if (!context?.mesh) return;

    const normalMatrix = context.mesh.worldMatrix.inverse().transpose();
    for (let i = 0; i < 16; i++) {
      buffer.setFloat32(offset + 64 + i * 4, normalMatrix.data[i], true);
    }
  }

  /**
   * Writes color and shininess to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (colorAndShininess at offset+128)
   */
  private _writeColorAndShininess(buffer: DataView, offset: number): void {
    buffer.setFloat32(offset + 128, this.color.r, true);
    buffer.setFloat32(offset + 132, this.color.g, true);
    buffer.setFloat32(offset + 136, this.color.b, true);
    buffer.setFloat32(offset + 140, this.shininess, true);
  }

  /**
   * Writes directional light data to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset
   * @param light - Directional light instance
   */
  private _writeDirectionalLight(
    buffer: DataView,
    offset: number,
    light: DirectionalLight,
  ): void {
    // Direction at offset+144
    buffer.setFloat32(offset + 144, light.direction.x, true);
    buffer.setFloat32(offset + 148, light.direction.y, true);
    buffer.setFloat32(offset + 152, light.direction.z, true);
    buffer.setFloat32(offset + 156, 0, true);

    // Color at offset+160
    buffer.setFloat32(offset + 160, light.color.r, true);
    buffer.setFloat32(offset + 164, light.color.g, true);
    buffer.setFloat32(offset + 168, light.color.b, true);
    buffer.setFloat32(offset + 172, light.intensity, true);

    // Light params at offset+192 (unused for directional)
    buffer.setFloat32(offset + 192, 0, true);
    buffer.setFloat32(offset + 196, 0, true);
    buffer.setFloat32(offset + 200, 0, true);
    buffer.setFloat32(offset + 204, 0, true);

    // Light types at offset+208 (type=0 for directional)
    buffer.setFloat32(offset + 208, 0, true);
    buffer.setFloat32(offset + 212, 0, true);
    buffer.setFloat32(offset + 216, 0, true);
    buffer.setFloat32(offset + 220, 0, true);
  }

  /**
   * Writes point light data to the uniform buffer.

   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset
   * @param light - Point light instance
   */
  private _writePointLight(
    buffer: DataView,
    offset: number,
    light: PointLight,
  ): void {
    light.updateWorldMatrix(true, false);
    buffer.setFloat32(offset + 144, light.worldMatrix.data[12], true);
    buffer.setFloat32(offset + 148, light.worldMatrix.data[13], true);
    buffer.setFloat32(offset + 152, light.worldMatrix.data[14], true);
    buffer.setFloat32(offset + 156, 0, true);

    // Color at offset+160
    buffer.setFloat32(offset + 160, light.color.r, true);
    buffer.setFloat32(offset + 164, light.color.g, true);
    buffer.setFloat32(offset + 168, light.color.b, true);
    buffer.setFloat32(offset + 172, light.intensity, true);

    // Light params at offset+192 (range and attenuation)
    const attenuationFactors = light.getAttenuationFactors();
    buffer.setFloat32(offset + 192, attenuationFactors[0], true); // range
    buffer.setFloat32(offset + 196, attenuationFactors[1], true); // param
    buffer.setFloat32(offset + 200, 0, true);
    buffer.setFloat32(offset + 204, 0, true);

    // Light types at offset+208 (type=1 for point)
    buffer.setFloat32(offset + 208, 1, true); // point light
    buffer.setFloat32(offset + 212, attenuationFactors[3], true); // attenuation type
    buffer.setFloat32(offset + 216, 0, true);
    buffer.setFloat32(offset + 220, 0, true);
  }

  /**
   * Writes default light data when no light is in the scene.

   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset
   */
  private _writeDefaultLight(buffer: DataView, offset: number): void {
    buffer.setFloat32(offset + 144, 0, true);
    buffer.setFloat32(offset + 148, -1, true);
    buffer.setFloat32(offset + 152, 0, true);
    buffer.setFloat32(offset + 156, 0, true);

    // Color at offset+160 (white, full intensity)
    buffer.setFloat32(offset + 160, 1, true);
    buffer.setFloat32(offset + 164, 1, true);
    buffer.setFloat32(offset + 168, 1, true);
    buffer.setFloat32(offset + 172, 1, true);

    // Light params at offset+192
    buffer.setFloat32(offset + 192, 0, true);
    buffer.setFloat32(offset + 196, 0, true);
    buffer.setFloat32(offset + 200, 0, true);
    buffer.setFloat32(offset + 204, 0, true);

    // Light types at offset+208 (directional)
    buffer.setFloat32(offset + 208, 0, true);
    buffer.setFloat32(offset + 212, 0, true);
    buffer.setFloat32(offset + 216, 0, true);
    buffer.setFloat32(offset + 220, 0, true);
  }

  /**
   * Writes camera position to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (cameraPosition at offset+176)
   * @param context - Rendering context
   */
  private _writeCameraPosition(
    buffer: DataView,
    offset: number,
    context?: RenderContext,
  ): void {
    if (!context?.camera) return;

    const cameraWorldMatrix = context.camera.worldMatrix.data;
    buffer.setFloat32(offset + 176, cameraWorldMatrix[12], true);
    buffer.setFloat32(offset + 180, cameraWorldMatrix[13], true);
    buffer.setFloat32(offset + 184, cameraWorldMatrix[14], true);
    buffer.setFloat32(offset + 188, 0, true);
  }

  /**
   * Writes displacement map parameters to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (displacement params at offset+224)
   */
  private _writeDisplacementParams(buffer: DataView, offset: number): void {
    buffer.setFloat32(offset + 224, this.displacementScale, true);
    buffer.setFloat32(offset + 228, this.displacementBias, true);
    buffer.setFloat32(offset + 232, this.normalScale, true);
    buffer.setFloat32(offset + 236, 0, true);
  }
}
