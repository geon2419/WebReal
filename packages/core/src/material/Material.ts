import type { Texture } from "../texture";
import type { Camera } from "../camera/Camera";
import type { Scene } from "../scene/Scene";
import type { Mesh } from "../scene/Mesh";
import type { Light } from "../light/Light";

/**
 * Defines the layout of vertex data in a GPU buffer.
 */
export interface VertexBufferLayout {
  arrayStride: number;
  attributes: {
    shaderLocation: number;
    offset: number;
    format: GPUVertexFormat;
  }[];
}

/**
 * Context information passed to materials during rendering.
 */
export interface RenderContext {
  camera: Camera;
  /** Scene currently being rendered (optional for scene-independent passes like skybox) */
  scene?: Scene;
  /** Mesh currently being rendered (optional for scene-independent passes like skybox) */
  mesh?: Mesh;
  /** Lights collected from the scene (collected once per frame by Renderer) */
  lights: Light[];
}

/**
 * Interface for materials that define how geometry is rendered.
 * Materials provide shaders, vertex layouts, and uniform data for the rendering pipeline.
 */
export interface Material {
  /** Unique identifier for the material type */
  readonly type: string;

  /**
   * Revision used to invalidate cached GPU bindings (bind groups) when
   * texture/sampler resources change without changing material.type/topology.
   *
   * - If omitted, Renderer treats it as 0.
   * - If a material mutates its bound resources (e.g., swapping textures),
   *   it should increment this value.
   */
  readonly bindingRevision?: number;

  /**
   * Gets the vertex shader code for this material.
   * @returns WGSL shader code as a string
   */
  getVertexShader(): string;

  /**
   * Gets the fragment shader code for this material.
   * @returns WGSL shader code as a string
   */
  getFragmentShader(): string;

  /**
   * Gets the vertex buffer layout describing vertex attribute structure.
   * @returns Vertex buffer layout configuration
   */
  getVertexBufferLayout(): VertexBufferLayout;

  /**
   * Gets the required size in bytes for the uniform buffer.
   * @returns Size in bytes
   */
  getUniformBufferSize(): number;

  /**
   * Absolute byte offset where material-specific uniforms begin in the uniform buffer.
   *
   * Renderer convention:
   * - 0..64: renderer-owned common block (typically MVP mat4x4f)
   * - offset..: material-specific block written by writeUniformData()
   *
   * Policy:
   * - If provided, this must be >= 64.
   * - If omitted, Renderer defaults to 64.
   */
  getUniformDataOffset?(): number;

  /**
   * Gets the primitive topology for rendering.
   * @returns GPU primitive topology (e.g., "triangle-list", "line-list")
   */
  getPrimitiveTopology(): GPUPrimitiveTopology;

  /**
   * Writes material-specific uniform data to the buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default varies by material, typically 64 after MVP matrix)
   * @param context - Optional rendering context with camera and optional scene/mesh information
   */
  writeUniformData?(
    buffer: DataView,
    offset: number,
    context?: RenderContext
  ): void;

  /**
   * Gets textures for multi-texture materials.
   * @param device - Optional GPUDevice for creating default/dummy textures
   * @returns Array of Texture objects to be bound to the shader
   */
  getTextures?(device?: GPUDevice): Texture[];

  /**
   * Gets IBL (Image-Based Lighting) textures for physically-based rendering.
   * Used by materials that support environment-based lighting.
   * @param device - GPUDevice for creating BRDF LUT if needed
   * @returns Object with prefilteredMap, irradianceMap, and brdfLUT, or null if IBL not configured
   */
  getIBLTextures?(device: GPUDevice): {
    prefilteredMap: import("../texture").CubeTexture;
    irradianceMap: import("../texture").CubeTexture;
    brdfLUT: Texture;
  } | null;
}
