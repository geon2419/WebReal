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
   * @param offset - Byte offset to start writing (typically 64, after MVP matrix)
   */
  writeUniformData?(buffer: DataView, offset?: number): void;
}
