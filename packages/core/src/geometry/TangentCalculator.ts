/**
 * Utility class for calculating tangent space (tangents and bitangents) for meshes.
 * Uses the standard algorithm described in "Mathematics for 3D Game Programming and Computer Graphics" by Eric Lengyel.
 *
 * @example
 * ```ts
 * const { tangents, bitangents } = TangentCalculator.calculate(
 *   positions,
 *   normals,
 *   uvs,
 *   indices
 * );
 * ```
 */
export class TangentCalculator {
  /**
   * Calculate tangents and bitangents for a mesh.
   *
   * @param positions - Vertex positions (3 components per vertex)
   * @param normals - Vertex normals (3 components per vertex)
   * @param uvs - Texture coordinates (2 components per vertex)
   * @param indices - Triangle indices
   * @returns Object containing tangents and bitangents Float32Arrays (3 components per vertex)
   */
  static calculate(
    positions: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    indices: Uint16Array
  ): { tangents: Float32Array; bitangents: Float32Array } {
  const vertexCount = positions.length / 3;
  const tangents = new Float32Array(vertexCount * 3);
  const bitangents = new Float32Array(vertexCount * 3);

  // Temporary arrays to accumulate tangent/bitangent contributions
  const tan1 = new Float32Array(vertexCount * 3);
  const tan2 = new Float32Array(vertexCount * 3);

  // Process each triangle
  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i];
    const i2 = indices[i + 1];
    const i3 = indices[i + 2];

    // Get positions
    const v1x = positions[i1 * 3];
    const v1y = positions[i1 * 3 + 1];
    const v1z = positions[i1 * 3 + 2];

    const v2x = positions[i2 * 3];
    const v2y = positions[i2 * 3 + 1];
    const v2z = positions[i2 * 3 + 2];

    const v3x = positions[i3 * 3];
    const v3y = positions[i3 * 3 + 1];
    const v3z = positions[i3 * 3 + 2];

    // Get UVs
    const w1x = uvs[i1 * 2];
    const w1y = uvs[i1 * 2 + 1];

    const w2x = uvs[i2 * 2];
    const w2y = uvs[i2 * 2 + 1];

    const w3x = uvs[i3 * 2];
    const w3y = uvs[i3 * 2 + 1];

    // Calculate edge vectors
    const x1 = v2x - v1x;
    const x2 = v3x - v1x;
    const y1 = v2y - v1y;
    const y2 = v3y - v1y;
    const z1 = v2z - v1z;
    const z2 = v3z - v1z;

    // Calculate UV deltas
    const s1 = w2x - w1x;
    const s2 = w3x - w1x;
    const t1 = w2y - w1y;
    const t2 = w3y - w1y;

    // Calculate tangent and bitangent
    const r = 1.0 / (s1 * t2 - s2 * t1);

    const sdirx = (t2 * x1 - t1 * x2) * r;
    const sdiry = (t2 * y1 - t1 * y2) * r;
    const sdirz = (t2 * z1 - t1 * z2) * r;

    const tdirx = (s1 * x2 - s2 * x1) * r;
    const tdiry = (s1 * y2 - s2 * y1) * r;
    const tdirz = (s1 * z2 - s2 * z1) * r;

    // Accumulate for all three vertices of the triangle
    for (const index of [i1, i2, i3]) {
      tan1[index * 3] += sdirx;
      tan1[index * 3 + 1] += sdiry;
      tan1[index * 3 + 2] += sdirz;

      tan2[index * 3] += tdirx;
      tan2[index * 3 + 1] += tdiry;
      tan2[index * 3 + 2] += tdirz;
    }
  }

  // Orthogonalize and normalize tangents/bitangents for each vertex
  for (let i = 0; i < vertexCount; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    const t1x = tan1[i * 3];
    const t1y = tan1[i * 3 + 1];
    const t1z = tan1[i * 3 + 2];

    const t2x = tan2[i * 3];
    const t2y = tan2[i * 3 + 1];
    const t2z = tan2[i * 3 + 2];

    // Gram-Schmidt orthogonalize
    // tangent = normalize(t - n * dot(n, t))
    const dot = nx * t1x + ny * t1y + nz * t1z;
    let tx = t1x - nx * dot;
    let ty = t1y - ny * dot;
    let tz = t1z - nz * dot;

    // Normalize tangent
    const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (tlen > 0) {
      tx /= tlen;
      ty /= tlen;
      tz /= tlen;
    }

    tangents[i * 3] = tx;
    tangents[i * 3 + 1] = ty;
    tangents[i * 3 + 2] = tz;

    // Calculate bitangent = cross(normal, tangent)
    // Check handedness
    const crossx = ny * tz - nz * ty;
    const crossy = nz * tx - nx * tz;
    const crossz = nx * ty - ny * tx;

    const handedness =
      crossx * t2x + crossy * t2y + crossz * t2z < 0 ? -1.0 : 1.0;

    bitangents[i * 3] = crossx * handedness;
    bitangents[i * 3 + 1] = crossy * handedness;
    bitangents[i * 3 + 2] = crossz * handedness;
  }

    return { tangents, bitangents };
  }
}
