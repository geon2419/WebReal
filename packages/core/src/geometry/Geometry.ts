export interface Geometry {
  /** Position data (vec3 per vertex) */
  readonly positions: Float32Array;

  /** Normal data (vec3 per vertex) */
  readonly normals: Float32Array;

  /** Index buffer */
  readonly indices: Uint16Array;

  /** Number of vertices */
  readonly vertexCount: number;

  /** Number of indices */
  readonly indexCount: number;

  /**
   * @deprecated Use `positions` instead. This property will be removed in a future version.
   * Interleaved vertex data for backward compatibility.
   */
  readonly vertices: Float32Array;
}
