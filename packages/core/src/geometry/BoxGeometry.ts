import type { Geometry, IndexArray } from "./Geometry";
import { TangentCalculator } from "./TangentCalculator";

export class BoxGeometry implements Geometry {
  private readonly _positions: Float32Array;
  private readonly _normals: Float32Array;
  private readonly _uvs: Float32Array;
  private readonly _tangents: Float32Array;
  private readonly _bitangents: Float32Array;
  private readonly _indices: IndexArray;
  private readonly _vertexCount: number;
  private readonly _indexCount: number;

  /**
   * @param width Width of the box
   * @param height Height of the box
   * @param depth Depth of the box
   * @param widthSegments Number of segments along the width (default: 1)
   * @param heightSegments Number of segments along the height (default: 1)
   * @param depthSegments Number of segments along the depth (default: 1)
   */
  constructor(
    public readonly width: number = 2,
    public readonly height: number = 2,
    public readonly depth: number = 2,
    public readonly widthSegments: number = 1,
    public readonly heightSegments: number = 1,
    public readonly depthSegments: number = 1,
  ) {
    const { positions, normals, uvs, indices } = this.generateData();
    this._positions = positions;
    this._normals = normals;
    this._uvs = uvs;
    this._indices = indices;
    this._vertexCount = positions.length / 3;
    this._indexCount = indices.length;

    // Calculate tangents and bitangents
    const { tangents, bitangents } = TangentCalculator.calculate(
      positions,
      normals,
      uvs,
      indices,
    );
    this._tangents = tangents;
    this._bitangents = bitangents;
  }

  get positions(): Float32Array {
    return this._positions;
  }

  get normals(): Float32Array {
    return this._normals;
  }

  get uvs(): Float32Array {
    return this._uvs;
  }

  get tangents(): Float32Array {
    return this._tangents;
  }

  get bitangents(): Float32Array {
    return this._bitangents;
  }

  get indices(): IndexArray {
    return this._indices;
  }

  get vertexCount(): number {
    return this._vertexCount;
  }

  get indexCount(): number {
    return this._indexCount;
  }

  private buildPlane(
    u: string,
    v: string,
    w: string,
    udir: number,
    vdir: number,
    width: number,
    height: number,
    depth: number,
    gridX: number,
    gridY: number,
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
  ): void {
    const segmentWidth = width / gridX;
    const segmentHeight = height / gridY;
    const widthHalf = width / 2;
    const heightHalf = height / 2;
    const depthHalf = depth / 2;
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const vertexCounter = positions.length / 3;

    // Generate vertices
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - heightHalf;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - widthHalf;
        const vertex: Record<string, number> = {};
        vertex[u] = x * udir;
        vertex[v] = y * vdir;
        vertex[w] = depthHalf;

        positions.push(vertex["x"] || 0, vertex["y"] || 0, vertex["z"] || 0);

        const normal: Record<string, number> = {};
        normal[u] = 0;
        normal[v] = 0;
        normal[w] = depth > 0 ? 1 : -1;

        normals.push(normal["x"] || 0, normal["y"] || 0, normal["z"] || 0);

        // Generate UV coordinates (0,0) at bottom-left, (1,1) at top-right
        uvs.push(ix / gridX, 1 - iy / gridY);
      }
    }

    // Generate indices
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = vertexCounter + ix + gridX1 * iy;
        const b = vertexCounter + ix + gridX1 * (iy + 1);
        const c = vertexCounter + (ix + 1) + gridX1 * (iy + 1);
        const d = vertexCounter + (ix + 1) + gridX1 * iy;

        // Two triangles per quad
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  private generateData(): {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
  } {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Build all six faces
    this.buildPlane(
      "z",
      "y",
      "x",
      -1,
      -1,
      this.depth,
      this.height,
      this.width,
      this.depthSegments,
      this.heightSegments,
      positions,
      normals,
      uvs,
      indices,
    ); // px
    this.buildPlane(
      "z",
      "y",
      "x",
      1,
      -1,
      this.depth,
      this.height,
      -this.width,
      this.depthSegments,
      this.heightSegments,
      positions,
      normals,
      uvs,
      indices,
    ); // nx
    this.buildPlane(
      "x",
      "z",
      "y",
      1,
      1,
      this.width,
      this.depth,
      this.height,
      this.widthSegments,
      this.depthSegments,
      positions,
      normals,
      uvs,
      indices,
    ); // py
    this.buildPlane(
      "x",
      "z",
      "y",
      1,
      -1,
      this.width,
      this.depth,
      -this.height,
      this.widthSegments,
      this.depthSegments,
      positions,
      normals,
      uvs,
      indices,
    ); // ny
    this.buildPlane(
      "x",
      "y",
      "z",
      1,
      -1,
      this.width,
      this.height,
      this.depth,
      this.widthSegments,
      this.heightSegments,
      positions,
      normals,
      uvs,
      indices,
    ); // pz
    this.buildPlane(
      "x",
      "y",
      "z",
      -1,
      -1,
      this.width,
      this.height,
      -this.depth,
      this.widthSegments,
      this.heightSegments,
      positions,
      normals,
      uvs,
      indices,
    ); // nz

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
    };
  }
}
