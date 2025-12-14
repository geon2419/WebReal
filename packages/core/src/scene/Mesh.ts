import type { Geometry, IndexArray } from "../geometry/Geometry";
import type { Material } from "../material/Material";
import { TangentCalculator } from "../geometry/TangentCalculator";
import { Object3D } from "./Object3D";
import { BoundingBox } from "@web-real/math";
import { computeBoundingBox } from "../geometry/BoundingUtils";

/**
 * Represents a renderable 3D mesh combining geometry and material.
 *
 * @example
 * ```ts
 * const geometry = new BoxGeometry(1, 1, 1);
 * const material = new BasicMaterial({ color: new Color(1, 0, 0) });
 * const mesh = new Mesh(geometry, material);
 * scene.add(mesh);
 * ```
 */
export class Mesh extends Object3D {
  private _geometry: Geometry;
  private _boundingBox: BoundingBox | null = null;
  private _interleavedVertices: Float32Array | null = null;
  private _material: Material;
  /** Set to true when geometry data changes and GPU buffers need to be updated */
  public needsUpdate: boolean = false;

  /**
   * Creates a new Mesh instance.
   * @param geometry - The geometry defining the mesh's shape
   * @param material - The material defining the mesh's appearance
   */
  constructor(geometry: Geometry, material: Material) {
    super();
    this._geometry = geometry;
    this._material = material;
  }

  /**
   * Gets the material used for rendering this mesh.
   * @returns The mesh's material
   */
  get material(): Material {
    return this._material;
  }

  set material(value: Material) {
    this._material = value;
    this._interleavedVertices = null; // Invalidate cache when material type changes
    this.needsUpdate = true;
  }

  /**
   * Gets the geometry defining this mesh's shape.
   * @returns The mesh's geometry
   */
  get geometry(): Geometry {
    return this._geometry;
  }

  set geometry(value: Geometry) {
    this._geometry = value;
    this._boundingBox = null; // Invalidate bounding box cache
    this._interleavedVertices = null; // Invalidate interleaved vertices cache
    this.needsUpdate = true;
  }

  /**
   * Gets the bounding box for this mesh's geometry (cached for performance).
   * @returns The mesh's axis-aligned bounding box
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
   * @returns Index array with line segments for each triangle edge
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
   * Returns interleaved vertex data based on the material type (cached until geometry or material changes).
   * @returns Float32Array containing interleaved vertex attributes
   */
  getInterleavedVertices(): Float32Array {
    if (this._interleavedVertices === null) {
      this._interleavedVertices = this._createInterleavedVertices();
    }
    return this._interleavedVertices;
  }

  /**
   * Creates interleaved vertex data based on material type.
   * This is called once and cached by getInterleavedVertices().
   */
  private _createInterleavedVertices(): Float32Array {
    const { positions } = this.geometry;

    switch (this.material.type) {
      case "texture":
        return this._interleavePositionNormalUV();

      case "parallax":
        return this._interleaveFullPBR(false);

      case "vertexColor":
      case "lineColor":
        return this._interleavePositionColor();

      case "line":
        return new Float32Array(positions);

      case "blinnPhong":
        return this._interleaveFullPBR(true);

      case "basic":
      default:
        return this._interleavePositionNormal();
    }
  }

  /**
   * Interleaves position and normal data (6 floats per vertex).
   * @returns Float32Array with layout: position(3) + normal(3)
   */
  private _interleavePositionNormal(): Float32Array {
    const { positions, normals } = this.geometry;
    const vertexCount = this.geometry.vertexCount;
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

  /**
   * Interleaves position, normal, and UV data (8 floats per vertex).
   * @returns Float32Array with layout: position(3) + normal(3) + uv(2)
   */
  private _interleavePositionNormalUV(): Float32Array {
    const { positions, normals, uvs } = this.geometry;
    const vertexCount = this.geometry.vertexCount;

    if (!uvs) {
      throw new Error(
        `${this.material.type} material requires geometry with UV coordinates`
      );
    }

    const data = new Float32Array(vertexCount * 8);

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

  /**
   * Interleaves position and color data (6 floats per vertex).
   * @returns Float32Array with layout: position(3) + color(3)
   */
  private _interleavePositionColor(): Float32Array {
    const { positions } = this.geometry;
    const vertexCount = this.geometry.vertexCount;

    // Get colors from material (both VertexColorMaterial and LineColorMaterial have colors)
    const colors = (this.material as any).colors as Float32Array;
    if (!colors) {
      throw new Error(
        `${this.material.type} material requires colors property`
      );
    }

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

  /**
   * Interleaves full PBR data for normal mapping (14 floats per vertex).
   * @param calculateIfMissing - Whether to calculate tangents at runtime if not provided by geometry
   * @returns Float32Array with layout: position(3) + normal(3) + uv(2) + tangent(3) + bitangent(3)
   */
  private _interleaveFullPBR(calculateIfMissing: boolean): Float32Array {
    const { positions, normals, uvs } = this.geometry;
    const vertexCount = this.geometry.vertexCount;

    if (!uvs) {
      throw new Error(
        `${this.material.type} material requires geometry with UV coordinates`
      );
    }

    let tangents = this.geometry.tangents;
    let bitangents = this.geometry.bitangents;

    if (!tangents || !bitangents) {
      if (calculateIfMissing) {
        // Calculate tangents at runtime if geometry doesn't provide them
        const calculated = TangentCalculator.calculate(
          positions,
          normals,
          uvs,
          this.geometry.indices
        );
        tangents = calculated.tangents;
        bitangents = calculated.bitangents;
      } else {
        throw new Error(
          `${this.material.type} material requires geometry with tangents and bitangents. ` +
            "Ensure your geometry class calculates and provides these attributes."
        );
      }
    }

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
}
