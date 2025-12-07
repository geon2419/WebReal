import type { Texture } from "../Texture";

export interface VertexBufferLayout {
  arrayStride: number;
  attributes: {
    shaderLocation: number;
    offset: number;
    format: GPUVertexFormat;
  }[];
}

export interface Material {
  readonly type: string;
  getVertexShader(): string;
  getFragmentShader(): string;
  getVertexBufferLayout(): VertexBufferLayout;
  getUniformBufferSize(): number;
  getPrimitiveTopology(): GPUPrimitiveTopology;
  /**
   * Optional method to write material-specific uniform data to the buffer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing. The default offset may vary depending on the material implementation (e.g., after MVP matrix).
   */
  writeUniformData?(buffer: DataView, offset?: number): void;
  /**
   * Optional method to get textures for multi-texture materials.
   * @param device - Optional GPUDevice for creating default/dummy textures
   * @returns Array of Texture objects to be bound to the shader
   */
  getTextures?(device?: GPUDevice): Texture[];
}
