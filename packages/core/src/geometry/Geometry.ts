export type IndexArray = Uint16Array | Uint32Array;

export interface Geometry {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: IndexArray;
  readonly uvs?: Float32Array;
  readonly tangents?: Float32Array;
  readonly bitangents?: Float32Array;
  readonly vertexCount: number;
  readonly indexCount: number;
}

/**
 * Creates an appropriate index array based on the maximum vertex index.
 * Uses Uint16Array if max index <= 65535 (more memory efficient),
 * and Uint32Array for larger meshes.
 *
 * @param indices - Array of vertex indices
 * @returns Uint16Array if max index <= 65535, otherwise Uint32Array
 */
export function createIndexArray(indices: number[]): IndexArray {
  if (indices.length === 0) {
    return new Uint16Array(0);
  }

  let maxIndex = 0;
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] > maxIndex) {
      maxIndex = indices[i];
    }
  }

  const MAX_UINT16 = 65535;
  return maxIndex > MAX_UINT16
    ? new Uint32Array(indices)
    : new Uint16Array(indices);
}

/**
 * Gets the WebGPU index format for the given index array.
 *
 * @param indices - The index array to check
 * @returns 'uint32' for Uint32Array, 'uint16' for Uint16Array
 */
export function getIndexFormat(indices: IndexArray): GPUIndexFormat {
  return indices instanceof Uint32Array ? "uint32" : "uint16";
}
