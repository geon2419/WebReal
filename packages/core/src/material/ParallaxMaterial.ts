import type { Material, VertexBufferLayout, RenderContext } from "./Material";
import { ShaderLib } from "../shaders";
import { Texture, DEFAULT_SAMPLER_OPTIONS } from "../texture";
import { PointLight } from "../light/PointLight";
import { DirectionalLight } from "../light/DirectionalLight";
import { AmbientLight } from "../light/AmbientLight";

export interface ParallaxMaterialOptions {
  albedo: Texture;
  depth: Texture;
  normal?: Texture;
  /** @default 0.05 */
  depthScale?: number;
  /** @default 1.0 */
  normalScale?: number;
  /** @default 32.0 */
  shininess?: number;
  /** @default true */
  generateNormalFromDepth?: boolean;
  /**
   * Cheap self-occlusion ("inner shadow") using the height map.
   * This is a low-cost approximation that darkens cavities.
   * @default false
   */
  selfShadow?: boolean;
  /**
   * Strength of the self-shadow effect.
   * @default 0.35
   */
  selfShadowStrength?: number;
  /**
   * Height sampling convention for the depth texture.
   * When true, height = 1 - depth.r (preserves current behavior).
   * @default true
   */
  invertHeight?: boolean;
}

/**
 * Parallax occlusion mapping material for 2.5D depth effects.
 * Requires geometry with UV, normals, tangents, and bitangents.
 *
 * @example
 * ```ts
 * const material = new ParallaxMaterial({
 *   albedo: albedoTexture,
 *   depth: depthTexture,
 *   normal: normalTexture,
 *   depthScale: 0.05,
 *   shininess: 32.0
 * });
 * ```
 */
export class ParallaxMaterial implements Material {
  readonly type = "parallax";
  readonly albedo: Texture;
  readonly depth: Texture;
  readonly normal?: Texture;
  private _depthScale: number;
  private _normalScale: number;
  private _shininess: number;
  private _selfShadowStrength: number;
  readonly generateNormalFromDepth: boolean;
  private _selfShadow: boolean;
  readonly invertHeight: boolean;
  private static _dummyNormalTexture?: Texture;

  /**
   * Creates a new ParallaxMaterial instance.
   * @param options - Configuration options for the material
   */
  constructor(options: ParallaxMaterialOptions) {
    this.albedo = options.albedo;
    this.depth = options.depth;
    this.normal = options.normal;
    this._depthScale = options.depthScale ?? 0.05;
    this._normalScale = options.normalScale ?? 1.0;
    this._shininess = options.shininess ?? 32.0;
    this.generateNormalFromDepth = options.generateNormalFromDepth ?? true;
    this._selfShadow = options.selfShadow ?? false;
    this._selfShadowStrength = options.selfShadowStrength ?? 0.35;
    this.invertHeight = options.invertHeight ?? true;

    // Validate depth scale range
    if (this._depthScale < 0.01 || this._depthScale > 0.1) {
      console.warn(
        `ParallaxMaterial: depthScale ${this._depthScale} is outside recommended range (0.01-0.1)`,
      );
    }

    // Validate normal scale range
    if (this._normalScale < 0.5 || this._normalScale > 2.0) {
      console.warn(
        `ParallaxMaterial: normalScale ${this._normalScale} is outside recommended range (0.5-2.0)`,
      );
    }

    // Validate shininess range
    if (this._shininess < 1 || this._shininess > 256) {
      console.warn(
        `ParallaxMaterial: shininess ${this._shininess} is outside recommended range (1-256)`,
      );
    }

    // Validate self-shadow strength range
    if (this._selfShadowStrength < 0 || this._selfShadowStrength > 1) {
      console.warn(
        `ParallaxMaterial: selfShadowStrength ${this._selfShadowStrength} is outside recommended range (0-1)`,
      );
    }
  }

  /**
   * Gets the depth scale value.
   */
  get depthScale(): number {
    return this._depthScale;
  }

  /**
   * Sets the depth scale value.
   * @param value - Depth scale value (recommended range: 0.01-0.1)
   */
  set depthScale(value: number) {
    if (value < 0.01 || value > 0.1) {
      console.warn(
        `ParallaxMaterial: depthScale ${value} is outside recommended range (0.01-0.1)`,
      );
    }
    this._depthScale = value;
  }

  /**
   * Gets the normal scale value.
   */
  get normalScale(): number {
    return this._normalScale;
  }

  /**
   * Sets the normal scale value.
   * @param value - Normal scale value (recommended range: 0.5-2.0)
   */
  set normalScale(value: number) {
    if (value < 0.5 || value > 2.0) {
      console.warn(
        `ParallaxMaterial: normalScale ${value} is outside recommended range (0.5-2.0)`,
      );
    }
    this._normalScale = value;
  }

  /**
   * Gets the shininess value.
   */
  get shininess(): number {
    return this._shininess;
  }

  /**
   * Sets the shininess value.
   * @param value - Shininess value (recommended range: 1-256)
   */
  set shininess(value: number) {
    if (value < 1 || value > 256) {
      console.warn(
        `ParallaxMaterial: shininess ${value} is outside recommended range (1-256)`,
      );
    }
    this._shininess = value;
  }

  /**
   * Gets whether cheap self-shadow (inner shadow) is enabled.
   */
  get selfShadow(): boolean {
    return this._selfShadow;
  }

  /**
   * Enables/disables cheap self-shadow (inner shadow).
   */
  set selfShadow(value: boolean) {
    this._selfShadow = value;
  }

  /**
   * Gets the self-shadow strength.
   */
  get selfShadowStrength(): number {
    return this._selfShadowStrength;
  }

  /**
   * Sets the self-shadow strength.
   * @param value - Strength value in [0, 1]
   */
  set selfShadowStrength(value: number) {
    if (value < 0 || value > 1) {
      console.warn(
        `ParallaxMaterial: selfShadowStrength ${value} is outside recommended range (0-1)`,
      );
    }
    this._selfShadowStrength = value;
  }

  /**
   * Gets the vertex shader code for parallax mapping.
   * @returns WGSL vertex shader code
   */
  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  /**
   * Gets the fragment shader code for parallax mapping.
   * @returns WGSL fragment shader code
   */
  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  /**
   * Gets the vertex buffer layout for position, normal, uv, tangent, bitangent.
   * @returns Vertex buffer layout with 56-byte stride
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
   * Gets the uniform buffer size for MVP, model matrix, camera, material params, ambient light, and up to 4 lights.
   * @returns 384 bytes
   */
  getUniformBufferSize(): number {
    return 384;
  }

  /**
   * Gets the primitive topology for rendering triangles.
   * @returns "triangle-list"
   */
  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }

  /**
   * Creates a 1x1 default normal texture with up-facing normal.
   * @param device - WebGPU device for texture creation
   * @returns Dummy normal texture with (0, 0, 1) normal vector
   */
  private static createDummyNormalTexture(device: GPUDevice): Texture {
    if (!this._dummyNormalTexture) {
      // Create a 1x1 texture with a default normal (0, 0, 1) encoded as (128, 128, 255)
      const texture = device.createTexture({
        size: [1, 1, 1],
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });

      // Write default normal data: (0.5, 0.5, 1.0, 1.0) in normalized space
      // Maps to (0, 0, 1) in tangent space after unpacking in shader
      const data = new Uint8Array([128, 128, 255, 255]);
      device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow: 4 },
        [1, 1, 1],
      );

      // Create a sampler using default options from Texture
      const sampler = device.createSampler(DEFAULT_SAMPLER_OPTIONS);

      this._dummyNormalTexture = new Texture(
        texture,
        sampler,
        1,
        1,
        "rgba8unorm",
        1,
      );
    }
    return this._dummyNormalTexture;
  }

  /**
   * Gets all textures for binding to the shader.
   * @param device - WebGPU device (required if no normal texture provided)
   * @returns Array of [albedo, depth, normal] textures
   */
  getTextures(device?: GPUDevice): Texture[] {
    const normalTexture =
      this.normal ||
      (device ? ParallaxMaterial.createDummyNormalTexture(device) : undefined);

    if (!normalTexture) {
      throw new Error(
        "ParallaxMaterial.getTextures() requires a GPUDevice parameter when no normal texture is provided",
      );
    }

    return [this.albedo, this.depth, normalTexture];
  }

  /**
   * Writes camera position, material parameters, ambient light, and up to 4 lights to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64). This represents the absolute position
   *                 where modelMatrix begins. All subsequent writes use relative offsets from this parameter.
   * @param context - Rendering context with camera, scene, and mesh information
   */
  writeUniformData(
    buffer: DataView,
    offset: number = 64,
    context?: RenderContext,
  ): void {
    this._writeModelMatrix(buffer, offset, context);
    this._writeCameraPosition(buffer, offset, context);
    this._writeMaterialParams(buffer, offset);
    this._writeAmbientLight(buffer, offset, context);
    const lightCount = this._writeLights(buffer, offset, context);
    this._writeLightCount(buffer, offset, lightCount);
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
   * Writes camera position to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (cameraPosition at offset+64)
   * @param context - Rendering context
   */
  private _writeCameraPosition(
    buffer: DataView,
    offset: number,
    context?: RenderContext,
  ): void {
    if (!context?.camera) return;

    const cameraWorldMatrix = context.camera.worldMatrix.data;
    buffer.setFloat32(offset + 64, cameraWorldMatrix[12], true);
    buffer.setFloat32(offset + 68, cameraWorldMatrix[13], true);
    buffer.setFloat32(offset + 72, cameraWorldMatrix[14], true);
    buffer.setFloat32(offset + 76, 0, true);
  }

  /**
   * Writes material parameters to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (materialParams at offset+80)
   */
  private _writeMaterialParams(buffer: DataView, offset: number): void {
    buffer.setFloat32(offset + 80, this.depthScale, true);
    buffer.setFloat32(offset + 84, this.normalScale, true);
    buffer.setFloat32(offset + 88, this.normal ? 1 : 0, true);
    buffer.setFloat32(offset + 92, this.shininess, true);
  }

  /**
   * Writes ambient light data to the uniform buffer.
   * Falls back to default dim white light (rgb=1.0, intensity=0.1) if no AmbientLight found.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (ambientLight at offset+96)
   * @param context - Rendering context
   */
  private _writeAmbientLight(
    buffer: DataView,
    offset: number,
    context?: RenderContext,
  ): void {
    let ambientLight: AmbientLight | undefined;

    if (context?.lights) {
      for (const light of context.lights) {
        if (light instanceof AmbientLight) {
          ambientLight = light;
          break;
        }
      }
    }

    if (ambientLight) {
      buffer.setFloat32(offset + 96, ambientLight.color.r, true);
      buffer.setFloat32(offset + 100, ambientLight.color.g, true);
      buffer.setFloat32(offset + 104, ambientLight.color.b, true);
      buffer.setFloat32(offset + 108, ambientLight.intensity, true);
    } else {
      // Default fallback: dim white ambient light
      buffer.setFloat32(offset + 96, 1.0, true);
      buffer.setFloat32(offset + 100, 1.0, true);
      buffer.setFloat32(offset + 104, 1.0, true);
      buffer.setFloat32(offset + 108, 0.1, true);
    }
  }

  /**
   * Writes light count to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (lightParams at offset+112)
   * @param lightCount - Number of active lights
   */
  private _writeLightCount(
    buffer: DataView,
    offset: number,
    lightCount: number,
  ): void {
    buffer.setFloat32(offset + 112, lightCount, true);
    // y: self-shadow strength (cheap inner shadow)
    buffer.setFloat32(
      offset + 116,
      this.selfShadow ? this.selfShadowStrength : 0,
      true,
    );
    buffer.setFloat32(offset + 120, 0, true); // reserved
    // reserved: pack parallax feature flags into lightParams.w (as float, decoded as u32 in WGSL)
    // bit0: invertHeight (height = 1 - depth.r)
    // bit1: generateNormalFromDepth
    // bit2: selfShadow (cheap inner shadow)
    let flags = 0;
    if (this.invertHeight) flags |= 1;
    if (this.generateNormalFromDepth) flags |= 2;
    if (this.selfShadow) flags |= 4;
    buffer.setFloat32(offset + 124, flags, true);
  }

  /**
   * Writes up to 4 lights (PointLight or DirectionalLight) to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Base offset (lights start at offset+128)
   * @param context - Rendering context
   * @returns Number of lights written
   */
  private _writeLights(
    buffer: DataView,
    offset: number,
    context?: RenderContext,
  ): number {
    const maxLights = 4;
    const lightBaseOffset = offset + 128; // lights start after ambientLight(16) + lightParams(16)
    let lightIndex = 0;

    if (context?.lights) {
      for (const light of context.lights) {
        if (lightIndex >= maxLights) break;
        if (light instanceof AmbientLight) continue; // Skip ambient, handled separately

        const lightOffset = lightBaseOffset + lightIndex * 48; // Each light: 48 bytes (3 x vec4f)

        if (light instanceof DirectionalLight) {
          this._writeDirectionalLight(buffer, lightOffset, light);
          lightIndex++;
        } else if (light instanceof PointLight) {
          this._writePointLight(buffer, lightOffset, light);
          lightIndex++;
        }
      }
    }

    // Zero out remaining light slots
    for (let i = lightIndex; i < maxLights; i++) {
      const lightOffset = lightBaseOffset + i * 48;
      for (let j = 0; j < 12; j++) {
        buffer.setFloat32(lightOffset + j * 4, 0, true);
      }
    }

    return lightIndex;
  }

  /**
   * Writes directional light data to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param lightOffset - Byte offset for this light slot
   * @param light - DirectionalLight instance
   */
  private _writeDirectionalLight(
    buffer: DataView,
    lightOffset: number,
    light: DirectionalLight,
  ): void {
    // Position slot used for direction vector (negated for incoming light direction)
    buffer.setFloat32(lightOffset, light.direction.x, true);
    buffer.setFloat32(lightOffset + 4, light.direction.y, true);
    buffer.setFloat32(lightOffset + 8, light.direction.z, true);
    buffer.setFloat32(lightOffset + 12, 0, true);

    // Color + intensity
    buffer.setFloat32(lightOffset + 16, light.color.r, true);
    buffer.setFloat32(lightOffset + 20, light.color.g, true);
    buffer.setFloat32(lightOffset + 24, light.color.b, true);
    buffer.setFloat32(lightOffset + 28, light.intensity, true);

    // Params: type=0 (directional), rest=0
    buffer.setFloat32(lightOffset + 32, 0, true); // type: directional
    buffer.setFloat32(lightOffset + 36, 0, true); // range (unused)
    buffer.setFloat32(lightOffset + 40, 0, true); // attenType (unused)
    buffer.setFloat32(lightOffset + 44, 0, true); // attenParam (unused)
  }

  /**
   * Writes point light data to the uniform buffer.
   * @param buffer - DataView of the uniform buffer
   * @param lightOffset - Byte offset for this light slot
   * @param light - PointLight instance
   */
  private _writePointLight(
    buffer: DataView,
    lightOffset: number,
    light: PointLight,
  ): void {
    light.updateWorldMatrix(true, false);

    // World position from transform matrix
    buffer.setFloat32(lightOffset, light.worldMatrix.data[12], true);
    buffer.setFloat32(lightOffset + 4, light.worldMatrix.data[13], true);
    buffer.setFloat32(lightOffset + 8, light.worldMatrix.data[14], true);
    buffer.setFloat32(lightOffset + 12, 0, true);

    // Color + intensity
    buffer.setFloat32(lightOffset + 16, light.color.r, true);
    buffer.setFloat32(lightOffset + 20, light.color.g, true);
    buffer.setFloat32(lightOffset + 24, light.color.b, true);
    buffer.setFloat32(lightOffset + 28, light.intensity, true);

    // Params: type=1 (point), range, attenType, attenParam
    const attenuationFactors = light.getAttenuationFactors();
    buffer.setFloat32(lightOffset + 32, 1.0, true); // type: point
    buffer.setFloat32(lightOffset + 36, attenuationFactors[0], true); // range
    buffer.setFloat32(lightOffset + 40, attenuationFactors[3], true); // attenType code
    buffer.setFloat32(lightOffset + 44, attenuationFactors[1], true); // attenParam
  }
}
