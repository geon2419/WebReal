export interface Geometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array;
  readonly uvs?: Float32Array;
  readonly vertexCount: number;
  readonly indexCount: number;
}
