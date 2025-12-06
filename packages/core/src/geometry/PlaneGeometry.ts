import type { Geometry } from "./Geometry";

/** Plane orientation options */
export type PlaneOrientation = "XY" | "XZ" | "YZ";

export interface PlaneGeometryOptions {
  /**
   * The width of the plane.
   * @default 1
   */
  width?: number;
  /**
   * The height of the plane.
   * @default 1
   */
  height?: number;
  /**
   * Number of segmented faces along the width of the plane. Must be >= 1.
   * @default 1
   */
  widthSegments?: number;
  /**
   * Number of segmented faces along the height of the plane. Must be >= 1.
   * @default 1
   */
  heightSegments?: number;
  /**
   * The orientation of the plane: "XY", "XZ", or "YZ".
   * @default "XY"
   */
  orientation?: PlaneOrientation;
}

export class PlaneGeometry implements Geometry {
  private readonly _positions: Float32Array;
  private readonly _normals: Float32Array;
  private readonly _indices: Uint16Array;
  private readonly _uvs: Float32Array;
  private readonly _vertexCount: number;
  private readonly _indexCount: number;

  public readonly width: number;
  public readonly height: number;
  public readonly widthSegments: number;
  public readonly heightSegments: number;
  public readonly orientation: PlaneOrientation;

  constructor(options: PlaneGeometryOptions = {}) {
    const {
      width = 1,
      height = 1,
      widthSegments = 1,
      heightSegments = 1,
      orientation = "XY",
    } = options;

    this.width = width;
    this.height = height;
    this.widthSegments = widthSegments;
    this.heightSegments = heightSegments;
    this.orientation = orientation;

    const { positions, normals, uvs, indices, vertexCount, indexCount } =
      this.generateData();

    this._positions = positions;
    this._normals = normals;
    this._uvs = uvs;
    this._indices = indices;
    this._vertexCount = vertexCount;
    this._indexCount = indexCount;
  }

  get positions(): Float32Array {
    return this._positions;
  }

  get normals(): Float32Array {
    return this._normals;
  }

  get indices(): Uint16Array {
    return this._indices;
  }

  get uvs(): Float32Array {
    return this._uvs;
  }

  get vertexCount(): number {
    return this._vertexCount;
  }

  get indexCount(): number {
    return this._indexCount;
  }

  private generateData(): {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
    vertexCount: number;
    indexCount: number;
  } {
    const { width, height, widthSegments, heightSegments, orientation } = this;

    const widthHalf = width / 2;
    const heightHalf = height / 2;

    const gridX = widthSegments;
    const gridY = heightSegments;

    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const segmentWidth = width / gridX;
    const segmentHeight = height / gridY;

    const vertexCount = gridX1 * gridY1;
    const indexCount = gridX * gridY * 6;

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Normal vector based on orientation
    const normalVector = this.getNormalVector(orientation);

    // Generate vertices
    for (let iy = 0; iy < gridY1; iy++) {
      const v = iy / gridY;
      const y = iy * segmentHeight - heightHalf;

      for (let ix = 0; ix < gridX1; ix++) {
        const u = ix / gridX;
        const x = ix * segmentWidth - widthHalf;

        // Set position based on orientation
        const position = this.getPosition(x, y, orientation);
        positions.push(...position);

        // Normal
        normals.push(...normalVector);

        // UV coordinates (bottom-left is (0,0), top-right is (1,1))
        uvs.push(u, 1 - v);
      }
    }

    // Generate indices (CCW winding)
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = ix + 1 + gridX1 * (iy + 1);
        const d = ix + 1 + gridX1 * iy;

        // Two triangles (CCW)
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
      vertexCount,
      indexCount,
    };
  }

  private getNormalVector(
    orientation: PlaneOrientation
  ): [number, number, number] {
    switch (orientation) {
      case "XY":
        return [0, 0, 1]; // +Z
      case "XZ":
        return [0, 1, 0]; // +Y
      case "YZ":
        return [1, 0, 0]; // +X
    }
  }

  private getPosition(
    u: number,
    v: number,
    orientation: PlaneOrientation
  ): [number, number, number] {
    switch (orientation) {
      case "XY":
        return [u, v, 0]; // X=u, Y=v, Z=0
      case "XZ":
        return [u, 0, v]; // X=u, Y=0, Z=v
      case "YZ":
        return [0, u, v]; // X=0, Y=u, Z=v
    }
  }
}
