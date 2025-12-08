import type { Material, VertexBufferLayout, RenderContext } from "./Material";
import { ShaderLib } from "../shaders";
import { Texture, DEFAULT_SAMPLER_OPTIONS } from "../Texture";
import { PointLight } from "../light/PointLight";

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
}

/**
 * Parallax occlusion mapping material for 2.5D depth effects.
 * Requires geometry with UV, normals, tangents, and bitangents.
 */
export class ParallaxMaterial implements Material {
  readonly type = "parallax";
  readonly albedo: Texture;
  readonly depth: Texture;
  readonly normal?: Texture;
  readonly depthScale: number;
  readonly normalScale: number;
  readonly shininess: number;
  readonly generateNormalFromDepth: boolean;
  private static _dummyNormalTexture?: Texture;

  constructor(options: ParallaxMaterialOptions) {
    this.albedo = options.albedo;
    this.depth = options.depth;
    this.normal = options.normal;
    this.depthScale = options.depthScale ?? 0.05;
    this.normalScale = options.normalScale ?? 1.0;
    this.shininess = options.shininess ?? 32.0;
    this.generateNormalFromDepth = options.generateNormalFromDepth ?? true;

    // Validate depth scale range
    if (this.depthScale < 0.01 || this.depthScale > 0.1) {
      console.warn(
        `ParallaxMaterial: depthScale ${this.depthScale} is outside recommended range (0.01-0.1)`
      );
    }

    // Validate normal scale range
    if (this.normalScale < 0.5 || this.normalScale > 2.0) {
      console.warn(
        `ParallaxMaterial: normalScale ${this.normalScale} is outside recommended range (0.5-2.0)`
      );
    }

    // Validate shininess range
    if (this.shininess < 1 || this.shininess > 256) {
      console.warn(
        `ParallaxMaterial: shininess ${this.shininess} is outside recommended range (1-256)`
      );
    }
  }

  /** @returns Vertex shader code */
  getVertexShader(): string {
    return ShaderLib.get(this.type).vertex;
  }

  /** @returns Fragment shader code */
  getFragmentShader(): string {
    return ShaderLib.get(this.type).fragment;
  }

  /** @returns Vertex buffer layout for position, normal, uv, tangent, bitangent */
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

  /** @returns 192 bytes */
  getUniformBufferSize(): number {
    return 192;
  }

  /** @returns "triangle-list" */
  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }

  /**
   * Creates 1x1 default normal texture (up-facing)
   * @param device - WebGPU device
   * @returns Dummy normal texture
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
        [1, 1, 1]
      );

      // Create a sampler using default options from Texture
      const sampler = device.createSampler(DEFAULT_SAMPLER_OPTIONS);

      this._dummyNormalTexture = new Texture(texture, sampler, 1, 1);
    }
    return this._dummyNormalTexture;
  }

  /**
   * Gets all textures for binding
   * @param device - WebGPU device (required if no normal texture provided)
   * @returns [albedo, depth, normal] - Uses dummy normal if not provided
   */
  getTextures(device?: GPUDevice): Texture[] {
    const normalTexture =
      this.normal ||
      (device ? ParallaxMaterial.createDummyNormalTexture(device) : undefined);

    if (!normalTexture) {
      throw new Error(
        "ParallaxMaterial.getTextures() requires a GPUDevice parameter when no normal texture is provided"
      );
    }

    return [this.albedo, this.depth, normalTexture];
  }

  /**
   * Writes camera, material params, and light data to uniform buffer
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 64)
   * @param context - Rendering context with camera, scene, and mesh info
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

    // Write camera position at offset 128 (vec4f: xyz = position, w unused)
    if (context?.camera) {
      const cameraWorldMatrix = context.camera.worldMatrix.data;
      buffer.setFloat32(offset + 64, cameraWorldMatrix[12], true); // offset 128
      buffer.setFloat32(offset + 68, cameraWorldMatrix[13], true); // offset 132
      buffer.setFloat32(offset + 72, cameraWorldMatrix[14], true); // offset 136
      buffer.setFloat32(offset + 76, 0, true); // offset 140 (w unused)
    }

    // Write material params at offset 144 (vec4f: x=depthScale, y=normalScale, z=useNormalMap, w=shininess)
    buffer.setFloat32(offset + 80, this.depthScale, true); // offset 144 (materialParams.x)
    buffer.setFloat32(offset + 84, this.normalScale, true); // offset 148 (materialParams.y)
    buffer.setFloat32(offset + 88, this.normal ? 1 : 0, true); // offset 152 (materialParams.z)
    buffer.setFloat32(offset + 92, this.shininess, true); // offset 156 (materialParams.w)

    // Get first light from context (pre-collected by Renderer)
    const light = context?.lights?.[0];

    // Write light data at offset 160+
    if (light instanceof PointLight) {
      light.updateWorldMatrix(true, false);
      // Write light position at offset 160 (vec4f: xyz = position, w unused)
      buffer.setFloat32(offset + 96, light.worldMatrix.data[12], true); // offset 160
      buffer.setFloat32(offset + 100, light.worldMatrix.data[13], true); // offset 164
      buffer.setFloat32(offset + 104, light.worldMatrix.data[14], true); // offset 168
      buffer.setFloat32(offset + 108, 0, true); // offset 172 (w unused)

      // Write light color at offset 176 (vec4f: rgb = color, a = intensity)
      buffer.setFloat32(offset + 112, light.color.r, true); // offset 176
      buffer.setFloat32(offset + 116, light.color.g, true); // offset 180
      buffer.setFloat32(offset + 120, light.color.b, true); // offset 184
      buffer.setFloat32(offset + 124, light.intensity, true); // offset 188
    } else {
      // Default light values
      buffer.setFloat32(offset + 96, 2, true); // offset 160 (x)
      buffer.setFloat32(offset + 100, 2, true); // offset 164 (y)
      buffer.setFloat32(offset + 104, 3, true); // offset 168 (z)
      buffer.setFloat32(offset + 108, 0, true); // offset 172 (w unused)

      buffer.setFloat32(offset + 112, 1, true); // offset 176 (r)
      buffer.setFloat32(offset + 116, 1, true); // offset 180 (g)
      buffer.setFloat32(offset + 120, 1, true); // offset 184 (b)
      buffer.setFloat32(offset + 124, 1, true); // offset 188 (intensity)
    }
  }
}
