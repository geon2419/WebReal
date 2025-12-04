import type { Geometry } from "./Geometry";
import type { PerspectiveCamera } from "../camera/PerspectiveCamera";
import { Matrix4 } from "@web-real-3d/math";

export interface FrustumColors {
  near?: [number, number, number];
  far?: [number, number, number];
  sides?: [number, number, number];
  cone?: [number, number, number];
}

/**
 * Geometry for visualizing a camera's view frustum as wireframe lines.
 * Generates 16 line segments (32 vertices) representing:
 * - 4 edges of the near plane
 * - 4 edges of the far plane  
 * - 4 connecting edges between near and far planes
 * - 4 cone lines from camera position to near plane corners
 * Supports different colors for near, far, and side edges.
 *
 * The frustum is computed by unprojecting NDC corners through the inverse
 * of the camera's projection-view matrix.
 */
export class FrustumGeometry implements Geometry {
  private _positions: Float32Array;
  private _colors: Float32Array;
  private readonly _normals: Float32Array;
  private readonly _indices: Uint16Array;
  private _vertexCount: number;
  private _frustumColors: Required<FrustumColors>;

  constructor(camera: PerspectiveCamera, colors: FrustumColors = {}) {
    // Normals are not used for line rendering
    this._normals = new Float32Array(0);
    // Non-indexed rendering for lines
    this._indices = new Uint16Array(0);
    this._positions = new Float32Array(0);
    this._colors = new Float32Array(0);
    this._vertexCount = 0;
    this._frustumColors = {
      near: colors.near ?? [1, 1, 0], // Yellow
      far: colors.far ?? [1, 0.5, 0], // Orange
      sides: colors.sides ?? [0.5, 0.5, 0.5], // Gray
      cone: colors.cone ?? [0.3, 0.3, 0.3], // Dark gray
    };

    this.update(camera);
  }

  get positions(): Float32Array {
    return this._positions;
  }

  get colors(): Float32Array {
    return this._colors;
  }

  get normals(): Float32Array {
    return this._normals;
  }

  get indices(): Uint16Array {
    return this._indices;
  }

  get vertexCount(): number {
    return this._vertexCount;
  }

  get indexCount(): number {
    return 0; // Non-indexed rendering
  }

  /**
   * Updates the frustum colors configuration.
   * Note: Call `update()` after this to apply the color changes to the geometry buffer.
   */
  setColors(colors: FrustumColors): void {
    if (colors.near) this._frustumColors.near = colors.near;
    if (colors.far) this._frustumColors.far = colors.far;
    if (colors.sides) this._frustumColors.sides = colors.sides;
    if (colors.cone) this._frustumColors.cone = colors.cone;
  }

  /**
   * Updates the frustum geometry based on camera parameters.
   * Call this when camera fov, aspect, near, or far changes.
   */
  update(camera: PerspectiveCamera): void {
    // Get the inverse of projection * view matrix
    const projViewMatrix = camera.projectionMatrix.multiply(camera.viewMatrix);
    const invProjView = projViewMatrix.inverse();

    // NDC corners (WebGPU uses Z range [0, 1])
    
    const frustumNdcCorners = [
      // Near plane (z = 0)
      [-1, -1, 0], // near bottom-left
      [1, -1, 0], // near bottom-right
      [1, 1, 0], // near top-right
      [-1, 1, 0], // near top-left
      // Far plane (z = 1)
      [-1, -1, 1], // far bottom-left
      [1, -1, 1], // far bottom-right
      [1, 1, 1], // far top-right
      [-1, 1, 1], // far top-left
    ];

    // Transform NDC corners to world space
    const frustumWorldCorners = frustumNdcCorners.map((ndc) =>
      this.unproject(ndc[0], ndc[1], ndc[2], invProjView)
    );

    // Camera position in world space
    const cameraPosition: [number, number, number] = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ];

    // Line segments with their color types
    // Each entry: [startIdx, endIdx, colorType]
    // colorType: 0 = near, 1 = far, 2 = sides, 3 = cone (camera to near)
    // Using -1 for camera position
    const lineSegments: [number, number, number][] = [
      // Near face (4 lines) - colorType 0
      [0, 1, 0],
      [1, 2, 0],
      [2, 3, 0],
      [3, 0, 0],
      // Far face (4 lines) - colorType 1
      [4, 5, 1],
      [5, 6, 1],
      [6, 7, 1],
      [7, 4, 1],
      // Connecting lines (4 lines) - colorType 2
      [0, 4, 2],
      [1, 5, 2],
      [2, 6, 2],
      [3, 7, 2],
      // Cone lines from camera to near plane corners (4 lines) - colorType 3
      [-1, 0, 3],
      [-1, 1, 3],
      [-1, 2, 3],
      [-1, 3, 3],
    ];

    const colorMap = [
      this._frustumColors.near,
      this._frustumColors.far,
      this._frustumColors.sides,
      this._frustumColors.cone,
    ];

    // Build position and color arrays for line-list topology (2 vertices per line)
    const positions: number[] = [];
    const colors: number[] = [];

    for (const [startIdx, endIdx, colorType] of lineSegments) {
      const start =
        startIdx === -1 ? cameraPosition : frustumWorldCorners[startIdx];
      const end = endIdx === -1 ? cameraPosition : frustumWorldCorners[endIdx];
      const color = colorMap[colorType];

      // Start vertex
      positions.push(start[0], start[1], start[2]);
      colors.push(color[0], color[1], color[2]);

      // End vertex
      positions.push(end[0], end[1], end[2]);
      colors.push(color[0], color[1], color[2]);
    }

    this._positions = new Float32Array(positions);
    this._colors = new Float32Array(colors);
    this._vertexCount = positions.length / 3; // 32 vertices (16 lines × 2)
  }

  /**
   * Unprojects a point from NDC space to world space.
   */
  private unproject(
    x: number,
    y: number,
    z: number,
    invProjView: Matrix4
  ): [number, number, number] {
    const matrixData = invProjView.data;

    // Apply inverse projection-view matrix to NDC point
    const worldX =
      matrixData[0] * x +
      matrixData[4] * y +
      matrixData[8] * z +
      matrixData[12];
    const worldY =
      matrixData[1] * x +
      matrixData[5] * y +
      matrixData[9] * z +
      matrixData[13];
    const worldZ =
      matrixData[2] * x +
      matrixData[6] * y +
      matrixData[10] * z +
      matrixData[14];
    const worldW =
      matrixData[3] * x +
      matrixData[7] * y +
      matrixData[11] * z +
      matrixData[15];

    // Perspective divide
    const invW = Math.abs(worldW) > 1e-10 ? 1.0 / worldW : 1.0;
    return [worldX * invW, worldY * invW, worldZ * invW];
  }
}
