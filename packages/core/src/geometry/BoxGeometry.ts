import type { Geometry } from "./Geometry";

/**
 * @deprecated Use VertexColorMaterial with faceColors option instead.
 * Default face colors for backward compatibility.
 */
const DEFAULT_FACE_COLORS: [number, number, number][] = [
  [1.0, 0.3, 0.3], // Front - Red
  [0.3, 1.0, 0.3], // Back - Green
  [0.3, 0.3, 1.0], // Top - Blue
  [1.0, 1.0, 0.3], // Bottom - Yellow
  [1.0, 0.3, 1.0], // Right - Magenta
  [0.3, 1.0, 1.0], // Left - Cyan
];

/** Normal vectors for each face */
const FACE_NORMALS: [number, number, number][] = [
  [0, 0, 1], // Front
  [0, 0, -1], // Back
  [0, 1, 0], // Top
  [0, -1, 0], // Bottom
  [1, 0, 0], // Right
  [-1, 0, 0], // Left
];

export class BoxGeometry implements Geometry {
  private readonly _positions: Float32Array;
  private readonly _normals: Float32Array;
  private readonly _vertices: Float32Array;
  private readonly _indices: Uint16Array;

  /**
   * @param width
   * @param height
   * @param depth
   */
  constructor(
    public readonly width: number = 2,
    public readonly height: number = 2,
    public readonly depth: number = 2
  ) {
    const { positions, normals, vertices, indices } = this.generateData();
    this._positions = positions;
    this._normals = normals;
    this._vertices = vertices;
    this._indices = indices;
  }

  /** Position data (vec3 per vertex) */
  get positions(): Float32Array {
    return this._positions;
  }

  /** Normal data (vec3 per vertex) */
  get normals(): Float32Array {
    return this._normals;
  }

  /**
   * @deprecated Use `positions` instead. This property will be removed in a future version.
   * Interleaved vertex data (position + color) for backward compatibility.
   */
  get vertices(): Float32Array {
    return this._vertices;
  }

  get indices(): Uint16Array {
    return this._indices;
  }

  get vertexCount(): number {
    // 6 faces × 4 vertices
    return 24;
  }

  get indexCount(): number {
    // 6 faces × 2 triangles × 3 vertices
    return 36;
  }

  private generateData(): {
    positions: Float32Array;
    normals: Float32Array;
    vertices: Float32Array;
    indices: Uint16Array;
  } {
    const w = this.width / 2;
    const h = this.height / 2;
    const d = this.depth / 2;

    // 24 vertices: 6 faces × 4 vertices
    const positionData: [number, number, number][] = [
      // Front face
      [-w, -h, d],
      [w, -h, d],
      [w, h, d],
      [-w, h, d],
      // Back face
      [w, -h, -d],
      [-w, -h, -d],
      [-w, h, -d],
      [w, h, -d],
      // Top face
      [-w, h, d],
      [w, h, d],
      [w, h, -d],
      [-w, h, -d],
      // Bottom face
      [-w, -h, -d],
      [w, -h, -d],
      [w, -h, d],
      [-w, -h, d],
      // Right face
      [w, -h, d],
      [w, -h, -d],
      [w, h, -d],
      [w, h, d],
      // Left face
      [-w, -h, -d],
      [-w, -h, d],
      [-w, h, d],
      [-w, h, -d],
    ];

    // Generate separate position and normal arrays
    const positions: number[] = [];
    const normals: number[] = [];

    for (let i = 0; i < 24; i++) {
      const faceIndex = Math.floor(i / 4);
      positions.push(...positionData[i]);
      normals.push(...FACE_NORMALS[faceIndex]);
    }

    // Interleaved vertex data for backward compatibility: position(vec3) + color(vec3)
    const vertexData: number[] = [];
    for (let i = 0; i < 24; i++) {
      const faceIndex = Math.floor(i / 4);
      const color = DEFAULT_FACE_COLORS[faceIndex];
      vertexData.push(...positionData[i], ...color);
    }

    // Indices for 12 triangles (6 faces × 2 triangles)
    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12,
      14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
    ]);

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      vertices: new Float32Array(vertexData),
      indices,
    };
  }
}
