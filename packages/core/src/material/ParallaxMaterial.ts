import type { Material, VertexBufferLayout } from "./Material";
import { ShaderLib } from "../shaders";
import type { Texture } from "../Texture";

export interface ParallaxMaterialOptions {
  /** Albedo/diffuse texture (color map) */
  albedo: Texture;
  /** Depth/height map texture (grayscale, white = high, black = low) */
  depth: Texture;
  /** Optional normal map texture for surface detail */
  normal?: Texture;
  /** Depth scale factor (0.01-0.1, default: 0.05) */
  depthScale?: number;
  /** Normal map intensity (0.5-2.0, default: 1.0) */
  normalScale?: number;
  /** Shininess for specular highlights (1-256, default: 32.0) */
  shininess?: number;
  /** Generate normal map from depth map if normal texture not provided */
  generateNormalFromDepth?: boolean;
}

/**
 * A material that renders with parallax occlusion mapping for 2.5D effects.
 * Requires geometry with UV coordinates and normals.
 * Supports albedo, depth, and optional normal maps.
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

  /**
   * Uniform buffer layout:
   * mat4x4f mvp             (64B)  offset 0
   * mat4x4f model           (64B)  offset 64
   * vec4f   cameraPos       (16B)  offset 128 (xyz = position, w unused)
   * vec4f   materialParams  (16B)  offset 144 (x = depthScale, y = normalScale, z = useNormalMap, w = shininess)
   * vec4f   lightPos        (16B)  offset 160 (xyz = position, w unused)
   * vec4f   lightColor      (16B)  offset 176 (rgb = color, a = intensity)
   * = 192 bytes (aligned to 16)
   */
  getUniformBufferSize(): number {
    return 192;
  }

  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }

  /**
   * Gets all textures for binding.
   * Order: [albedo, depth, normal?]
   */
  getTextures(): Texture[] {
    const textures = [this.albedo, this.depth];
    if (this.normal) {
      textures.push(this.normal);
    }
    return textures;
  }

  /**
   * Writes material-specific uniform data to the buffer.
   * MVP matrix should be written at offset 0.
   * Model matrix should be written at offset 64.
   * Camera position and other params written here.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 128, after MVP + Model matrices)
   */
  writeUniformData(buffer: DataView, offset: number = 128): void {
    // Camera position will be written by Renderer at offset 128-143 (vec4f)
    // Material params at offset 144-159 (vec4f)
    buffer.setFloat32(offset + 16, this.depthScale, true); // offset 144 (materialParams.x)
    buffer.setFloat32(offset + 20, this.normalScale, true); // offset 148 (materialParams.y)
    buffer.setFloat32(offset + 24, this.normal ? 1 : 0, true); // offset 152 (materialParams.z)
    buffer.setFloat32(offset + 28, this.shininess, true); // offset 156 (materialParams.w)
    // Light data will be written by Renderer at offset 160+
  }
}
