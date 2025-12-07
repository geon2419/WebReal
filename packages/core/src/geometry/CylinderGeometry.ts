import type { Geometry } from "./Geometry";
import { TangentCalculator } from "./TangentCalculator";

export interface CylinderGeometryOptions {
  /**
   * Radius of the top of the cylinder.
   * @default 1
   */
  radiusTop?: number;
  /**
   * Radius of the bottom of the cylinder.
   * @default 1
   */
  radiusBottom?: number;
  /**
   * Height of the cylinder.
   * @default 1
   */
  height?: number;
  /**
   * Number of segmented faces around the circumference.
   * @default 32
   */
  radialSegments?: number;
  /**
   * Number of rows of faces along the height.
   * @default 1
   */
  heightSegments?: number;
  /**
   * Whether the ends of the cylinder are open or capped.
   * @default false
   */
  openEnded?: boolean;
  /**
   * Starting angle for the first segment in radians.
   * @default 0
   */
  thetaStart?: number;
  /**
   * The central angle of the circular sector in radians.
   * @default Math.PI * 2
   */
  thetaLength?: number;
}

/**
 * Represents a cylinder geometry, which can be a standard cylinder, cone, or truncated cone.
 * The cylinder is generated along the Y-axis with customizable top and bottom radii.
 * Supports open ends, partial cylinders, and height subdivisions.
 *
 * @example
 * ```ts
 * // Create a standard cylinder
 * const cylinder = new CylinderGeometry({
 *   radiusTop: 1,
 *   radiusBottom: 1,
 *   height: 2,
 *   radialSegments: 32
 * });
 *
 * // Create a cone
 * const cone = new CylinderGeometry({
 *   radiusTop: 0,
 *   radiusBottom: 1,
 *   height: 2
 * });
 *
 * // Create a partial cylinder (pie slice)
 * const partial = new CylinderGeometry({
 *   thetaLength: Math.PI
 * });
 * ```
 */
export class CylinderGeometry implements Geometry {
  private readonly _positions: Float32Array;
  private readonly _normals: Float32Array;
  private readonly _uvs: Float32Array;
  private readonly _tangents: Float32Array;
  private readonly _bitangents: Float32Array;
  private readonly _indices: Uint16Array;
  private readonly _vertexCount: number;
  private readonly _indexCount: number;

  public readonly radiusTop: number;
  public readonly radiusBottom: number;
  public readonly height: number;
  public readonly radialSegments: number;
  public readonly heightSegments: number;
  public readonly openEnded: boolean;
  public readonly thetaStart: number;
  public readonly thetaLength: number;

  constructor(options: CylinderGeometryOptions = {}) {
    const {
      radiusTop = 1,
      radiusBottom = 1,
      height = 1,
      radialSegments = 32,
      heightSegments = 1,
      openEnded = false,
      thetaStart = 0,
      thetaLength = Math.PI * 2,
    } = options;

    this.radiusTop = radiusTop;
    this.radiusBottom = radiusBottom;
    this.height = height;
    this.radialSegments = Math.max(3, Math.floor(radialSegments));
    this.heightSegments = Math.max(1, Math.floor(heightSegments));
    this.openEnded = openEnded;
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
      indices
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

  get indices(): Uint16Array {
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

    let index = 0;
    const indexArray: number[][] = [];

    // Calculate slope for normal calculation (accounts for cone angle)
    const slope = (this.radiusBottom - this.radiusTop) / this.height;
    const slopeLength = Math.sqrt(slope * slope + 1);
    const normalY = slope / slopeLength;
    const normalXZScale = 1 / slopeLength;

    // Generate cylinder body
    for (let y = 0; y <= this.heightSegments; y++) {
      const indexRow: number[] = [];
      const v = y / this.heightSegments;
      const yPos = v * this.height - this.height / 2;
      const radius = v * (this.radiusBottom - this.radiusTop) + this.radiusTop;

      for (let x = 0; x <= this.radialSegments; x++) {
        const u = x / this.radialSegments;
        const theta = this.thetaStart + u * this.thetaLength;

        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        // Position
        const xPos = radius * sinTheta;
        const zPos = radius * cosTheta;
        positions.push(xPos, yPos, zPos);

        // Normal (accounts for cone slope)
        const nx = sinTheta * normalXZScale;
        const ny = normalY;
        const nz = cosTheta * normalXZScale;
        normals.push(nx, ny, nz);

        // UV
        uvs.push(u, 1 - v);

        indexRow.push(index++);
      }

      indexArray.push(indexRow);
    }

    // Generate indices for cylinder body
    for (let y = 0; y < this.heightSegments; y++) {
      for (let x = 0; x < this.radialSegments; x++) {
        const a = indexArray[y][x];
        const b = indexArray[y + 1][x];
        const c = indexArray[y + 1][x + 1];
        const d = indexArray[y][x + 1];

        // Two triangles per quad (CCW winding)
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    // Generate top cap
    if (!this.openEnded && this.radiusTop > 0) {
      this.generateCap(true, positions, normals, uvs, indices, index);
      index += this.radialSegments + 2; // center + ring vertices
    }

    // Generate bottom cap
    if (!this.openEnded && this.radiusBottom > 0) {
      this.generateCap(false, positions, normals, uvs, indices, index);
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

  private generateCap(
    isTop: boolean,
    positions: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    startIndex: number
  ): void {
    const radius = isTop ? this.radiusTop : this.radiusBottom;
    const yPos = isTop ? this.height / 2 : -this.height / 2;
    const normalY = isTop ? 1 : -1;

    // Center vertex
    const centerIndex = startIndex;
    positions.push(0, yPos, 0);
    normals.push(0, normalY, 0);
    uvs.push(0.5, 0.5);

    // Ring vertices
    for (let x = 0; x <= this.radialSegments; x++) {
      const u = x / this.radialSegments;
      const theta = this.thetaStart + u * this.thetaLength;

      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const xPos = radius * sinTheta;
      const zPos = radius * cosTheta;

      positions.push(xPos, yPos, zPos);
      normals.push(0, normalY, 0);

      // Circular UV mapping
      uvs.push(0.5 + sinTheta * 0.5, 0.5 + cosTheta * 0.5);
    }

    // Generate indices (fan triangulation)
    for (let x = 0; x < this.radialSegments; x++) {
      const a = centerIndex;
      const b = startIndex + x + 1;
      const c = startIndex + x + 2;

      if (isTop) {
        // CCW winding for top (viewed from above)
        indices.push(a, b, c);
      } else {
        // CCW winding for bottom (viewed from below)
        indices.push(a, c, b);
      }
    }
  }
}
