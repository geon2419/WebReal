import type { Geometry, IndexArray } from "./Geometry";
import { TangentCalculator } from "./TangentCalculator";

export interface SphereGeometryOptions {
  /**
   * Radius of the sphere.
   * @default 1
   */
  radius?: number;
  /**
   * Number of horizontal segments (longitude).
   * @default 32
   */
  widthSegments?: number;
  /**
   * Number of vertical segments (latitude).
   * @default 16
   */
  heightSegments?: number;
  /**
   * Starting azimuthal angle (phi) in radians.
   * @default 0
   */
  phiStart?: number;
  /**
   * Horizontal sweep angle size in radians.
   * @default Math.PI * 2
   */
  phiLength?: number;
  /**
   * Starting polar angle (theta) in radians.
   * @default 0
   */
  thetaStart?: number;
  /**
   * Vertical sweep angle size in radians.
   * @default Math.PI
   */
  thetaLength?: number;
}

/**
 * Represents a sphere geometry, which is a 3D surface where all points are equidistant from a center point.
 * The sphere is generated using latitude/longitude segments (UV sphere).
 * Supports partial spheres through phi and theta parameters.
 *
 * @example
 * ```ts
 * // Create a sphere geometry with radius 2 and 32x16 segments
 * const sphere = new SphereGeometry({
 *   radius: 2,
 *   widthSegments: 32,
 *   heightSegments: 16
 * });
 *
 * // Create a hemisphere (half sphere)
 * const hemisphere = new SphereGeometry({
 *   radius: 1,
 *   thetaLength: Math.PI / 2
 * });
 * ```
 */
export class SphereGeometry implements Geometry {
  private readonly _positions: Float32Array;
  private readonly _normals: Float32Array;
  private readonly _uvs: Float32Array;
  private readonly _tangents: Float32Array;
  private readonly _bitangents: Float32Array;
  private readonly _indices: IndexArray;
  private readonly _vertexCount: number;
  private readonly _indexCount: number;

  public readonly radius: number;
  public readonly widthSegments: number;
  public readonly heightSegments: number;
  public readonly phiStart: number;
  public readonly phiLength: number;
  public readonly thetaStart: number;
  public readonly thetaLength: number;

  constructor(options: SphereGeometryOptions = {}) {
    const {
      radius = 1,
      widthSegments = 32,
      heightSegments = 16,
      phiStart = 0,
      phiLength = Math.PI * 2,
      thetaStart = 0,
      thetaLength = Math.PI,
    } = options;

    this.radius = radius;
    this.widthSegments = Math.max(3, Math.floor(widthSegments));
    this.heightSegments = Math.max(2, Math.floor(heightSegments));
    this.phiStart = phiStart;
    this.phiLength = phiLength;
    this.thetaStart = thetaStart;
    this.thetaLength = thetaLength;

    const { positions, normals, uvs, indices, vertexCount, indexCount } =
      this.generateData();

    this._positions = positions;
    this._normals = normals;
    this._uvs = uvs;
    this._indices = indices;
    this._vertexCount = vertexCount;
    this._indexCount = indexCount;

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

  private generateData(): {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
    vertexCount: number;
    indexCount: number;
  } {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const thetaEnd = Math.min(this.thetaStart + this.thetaLength, Math.PI);

    let index = 0;
    const grid: number[][] = [];

    // Generate vertices
    for (let iy = 0; iy <= this.heightSegments; iy++) {
      const verticesRow: number[] = [];
      const v = iy / this.heightSegments;

      // Special case for poles
      let uOffset = 0;
      if (iy === 0 && this.thetaStart === 0) {
        uOffset = 0.5 / this.widthSegments;
      } else if (iy === this.heightSegments && thetaEnd === Math.PI) {
        uOffset = -0.5 / this.widthSegments;
      }

      for (let ix = 0; ix <= this.widthSegments; ix++) {
        const u = ix / this.widthSegments;

        // Position
        const phi = this.phiStart + u * this.phiLength;
        const theta = this.thetaStart + v * this.thetaLength;

        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = -this.radius * sinTheta * cosPhi;
        const y = this.radius * cosTheta;
        const z = this.radius * sinTheta * sinPhi;

        positions.push(x, y, z);

        // Normal (normalized position vector from center)
        normals.push(x / this.radius, y / this.radius, z / this.radius);

        // UV
        uvs.push(u + uOffset, 1 - v);

        verticesRow.push(index++);
      }

      grid.push(verticesRow);
    }

    // Generate indices
    for (let iy = 0; iy < this.heightSegments; iy++) {
      for (let ix = 0; ix < this.widthSegments; ix++) {
        const a = grid[iy][ix + 1];
        const b = grid[iy][ix];
        const c = grid[iy + 1][ix];
        const d = grid[iy + 1][ix + 1];

        // Triangles (CCW winding)
        if (iy !== 0 || this.thetaStart > 0) {
          indices.push(a, b, d);
        }
        if (iy !== this.heightSegments - 1 || thetaEnd < Math.PI) {
          indices.push(b, c, d);
        }
      }
    }

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
      vertexCount: positions.length / 3,
      indexCount: indices.length,
    };
  }
}
