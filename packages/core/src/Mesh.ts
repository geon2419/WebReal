import type { Geometry, IndexArray } from "./geometry/Geometry";
import type { Material } from "./material/Material";
import { VertexColorMaterial } from "./material/VertexColorMaterial";
import { Object3D } from "./Object3D";
import { BoundingBox } from "@web-real/math";
import { computeBoundingBox } from "./geometry/BoundingUtils";

export class Mesh extends Object3D {
  private _geometry: Geometry;
  private _boundingBox: BoundingBox | null = null;
  public material: Material;
  /** Set to true when geometry data changes and GPU buffers need to be updated */
  public needsUpdate: boolean = false;

  constructor(geometry: Geometry, material: Material) {
    super();
    this._geometry = geometry;
    this.material = material;
  }

  get geometry(): Geometry {
    return this._geometry;
  }

  set geometry(value: Geometry) {
    this._geometry = value;
    this._boundingBox = null; // Invalidate bounding box cache
    this.needsUpdate = true;
  }

  /**
   * Gets the cached bounding box for this mesh's geometry.
   * The bounding box is computed once and cached for performance.
   * Cache is invalidated when geometry changes.
   */
  get boundingBox(): BoundingBox {
    if (this._boundingBox === null) {
      this._boundingBox = computeBoundingBox(this._geometry);
    }
    return this._boundingBox;
  }

  get indices(): IndexArray {
    return this.geometry.indices;
  }

  get vertexCount(): number {
    return this.geometry.vertexCount;
  }

  get indexCount(): number {
    return this.geometry.indexCount;
  }

  /**
   * Generates wireframe indices from triangle indices.
   * Converts each triangle (a, b, c) to three line segments (a-b, b-c, c-a).
   * @returns IndexArray of wireframe indices (same type as original indices)
   */
  getWireframeIndices(): IndexArray {
    const triangleIndices = this.geometry.indices;
    const triangleCount = triangleIndices.length / 3;
    const wireframeIndices =
      triangleIndices instanceof Uint32Array
        ? new Uint32Array(triangleCount * 6)
        : new Uint16Array(triangleCount * 6);

    for (let i = 0; i < triangleCount; i++) {
      const offset = i * 3;
      const a = triangleIndices[offset];
      const b = triangleIndices[offset + 1];
      const c = triangleIndices[offset + 2];

      const wireOffset = i * 6;
      wireframeIndices[wireOffset] = a;
      wireframeIndices[wireOffset + 1] = b;
      wireframeIndices[wireOffset + 2] = b;
      wireframeIndices[wireOffset + 3] = c;
      wireframeIndices[wireOffset + 4] = c;
      wireframeIndices[wireOffset + 5] = a;
    }

    return wireframeIndices;
  }

  /**
   * Returns interleaved vertex data based on the material type.
   */
  getInterleavedVertices(): Float32Array {
    const { positions, normals, uvs } = this.geometry;
    const vertexCount = this.geometry.vertexCount;

    switch (this.material.type) {
      case "texture": {
        // Texture material needs positions + normals + UVs
        if (!uvs) {
          throw new Error(
            "TextureMaterial requires geometry with UV coordinates"
          );
        }
        const data = new Float32Array(vertexCount * 8); // 3 + 3 + 2 = 8

        for (let i = 0; i < vertexCount; i++) {
          const posOffset = i * 3;
          const uvOffset = i * 2;
          const dataOffset = i * 8;

          // position
          data[dataOffset] = positions[posOffset];
          data[dataOffset + 1] = positions[posOffset + 1];
          data[dataOffset + 2] = positions[posOffset + 2];

          // normal
          data[dataOffset + 3] = normals[posOffset];
          data[dataOffset + 4] = normals[posOffset + 1];
          data[dataOffset + 5] = normals[posOffset + 2];

          // uv
          data[dataOffset + 6] = uvs[uvOffset];
          data[dataOffset + 7] = uvs[uvOffset + 1];
        }

        return data;
      }

      case "parallax": {
        // Parallax material needs positions + normals + UVs + tangents + bitangents
        if (!uvs) {
          throw new Error(
            "ParallaxMaterial requires geometry with UV coordinates"
          );
        }
        const { tangents, bitangents } = this.geometry;
        if (!tangents || !bitangents) {
          throw new Error(
            "ParallaxMaterial requires geometry with tangents and bitangents. " +
              "Ensure your geometry class calculates and provides these attributes."
          );
        }

        // position(3) + normal(3) + uv(2) + tangent(3) + bitangent(3) = 14 floats
        const data = new Float32Array(vertexCount * 14);

        for (let i = 0; i < vertexCount; i++) {
          const posOffset = i * 3;
          const uvOffset = i * 2;
          const dataOffset = i * 14;

          // position
          data[dataOffset] = positions[posOffset];
          data[dataOffset + 1] = positions[posOffset + 1];
          data[dataOffset + 2] = positions[posOffset + 2];

          // normal
          data[dataOffset + 3] = normals[posOffset];
          data[dataOffset + 4] = normals[posOffset + 1];
          data[dataOffset + 5] = normals[posOffset + 2];

          // uv
          data[dataOffset + 6] = uvs[uvOffset];
          data[dataOffset + 7] = uvs[uvOffset + 1];

          // tangent
          data[dataOffset + 8] = tangents[posOffset];
          data[dataOffset + 9] = tangents[posOffset + 1];
          data[dataOffset + 10] = tangents[posOffset + 2];

          // bitangent
          data[dataOffset + 11] = bitangents[posOffset];
          data[dataOffset + 12] = bitangents[posOffset + 1];
          data[dataOffset + 13] = bitangents[posOffset + 2];
        }

        return data;
      }

      case "vertexColor": {
        const colors = (this.material as VertexColorMaterial).colors;
        const data = new Float32Array(vertexCount * 6);

        for (let i = 0; i < vertexCount; i++) {
          const posOffset = i * 3;
          const dataOffset = i * 6;

          data[dataOffset] = positions[posOffset];
          data[dataOffset + 1] = positions[posOffset + 1];
          data[dataOffset + 2] = positions[posOffset + 2];

          data[dataOffset + 3] = colors[posOffset];
          data[dataOffset + 4] = colors[posOffset + 1];
          data[dataOffset + 5] = colors[posOffset + 2];
        }

        return data;
      }

      case "line": {
        // Line material only needs positions (no normals or colors)
        return positions;
      }

      case "lineColor": {
        // LineColor material needs positions + colors interleaved
        const lineColorMaterial = this.material as unknown as {
          colors: Float32Array;
        };
        const colors = lineColorMaterial.colors;
        const data = new Float32Array(vertexCount * 6);

        for (let i = 0; i < vertexCount; i++) {
          const posOffset = i * 3;
          const dataOffset = i * 6;

          data[dataOffset] = positions[posOffset];
          data[dataOffset + 1] = positions[posOffset + 1];
          data[dataOffset + 2] = positions[posOffset + 2];

          data[dataOffset + 3] = colors[posOffset];
          data[dataOffset + 4] = colors[posOffset + 1];
          data[dataOffset + 5] = colors[posOffset + 2];
        }

        return data;
      }

      case "basic":
      case "blinnPhong":
      default: {
        // Default: interleave position + normal
        const data = new Float32Array(vertexCount * 6);

        for (let i = 0; i < vertexCount; i++) {
          const offset = i * 3;
          const dataOffset = i * 6;

          data[dataOffset] = positions[offset];
          data[dataOffset + 1] = positions[offset + 1];
          data[dataOffset + 2] = positions[offset + 2];

          data[dataOffset + 3] = normals[offset];
          data[dataOffset + 4] = normals[offset + 1];
          data[dataOffset + 5] = normals[offset + 2];
        }

        return data;
      }
    }
  }
}
