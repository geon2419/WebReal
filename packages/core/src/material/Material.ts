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
}
