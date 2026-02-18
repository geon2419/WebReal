import type { PointLight } from "./PointLight";
import { Color } from "@web-real/math";
import { LineMaterial } from "../material/LineMaterial";
import { Mesh } from "../scene/Mesh";
import type { Geometry } from "../geometry/Geometry";

/**
 * Geometry for PointLightHelper - a wireframe cube showing light position.
 * Creates a small cube with 12 edges rendered as lines.
 */
class PointLightHelperGeometry implements Geometry {
  positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array = new Uint16Array(0);
  readonly vertexCount: number;
  readonly indexCount: number = 0;

  private readonly size: number = 0.2;

  /**
   * Creates a new PointLightHelperGeometry instance.
   * Builds a wireframe cube with 24 vertices (12 edges × 2 vertices per line).
   */
  constructor() {
    // Wireframe cube: 12 edges × 2 vertices per line = 24 vertices
    this.vertexCount = 24;
    this.positions = new Float32Array(this.vertexCount * 3);
    this.normals = new Float32Array(this.vertexCount * 3); // unused for lines

    this.buildCube();
  }

  private buildCube(): void {
    const s = this.size / 2;

    // 8 corners of the cube
    const corners = [
      [-s, -s, -s], // 0: left-bottom-back
      [s, -s, -s], // 1: right-bottom-back
      [s, s, -s], // 2: right-top-back
      [-s, s, -s], // 3: left-top-back
      [-s, -s, s], // 4: left-bottom-front
      [s, -s, s], // 5: right-bottom-front
      [s, s, s], // 6: right-top-front
      [-s, s, s], // 7: left-top-front
    ];

    // 12 edges as pairs of corner indices
    const edges = [
      // Back face
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      // Front face
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      // Connecting edges
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];

    let idx = 0;
    for (const [a, b] of edges) {
      // Start vertex
      this.positions[idx++] = corners[a][0];
      this.positions[idx++] = corners[a][1];
      this.positions[idx++] = corners[a][2];
      // End vertex
      this.positions[idx++] = corners[b][0];
      this.positions[idx++] = corners[b][1];
      this.positions[idx++] = corners[b][2];
    }
  }
}

/**
 * A helper class that visualizes a PointLight's position.
 * Displays a small wireframe cube at the light's position.
 *
 * @example
 * ```typescript
 * const light = new PointLight(new Color(1, 1, 1), 1.0, 10);
 * light.position.set(3, 3, 3);
 * const helper = new PointLightHelper(light);
 * scene.add(helper);
 *
 * // Update when light position changes
 * light.position.set(0, 5, 0);
 * helper.update();
 * ```
 */
export class PointLightHelper extends Mesh {
  private readonly light: PointLight;

  /**
   * Creates a new PointLightHelper instance.
   * @param light - The PointLight to visualize
   */
  constructor(light: PointLight) {
    const geometry = new PointLightHelperGeometry();
    const material = new LineMaterial({ color: new Color(1, 1, 0) }); // Yellow

    super(geometry, material);

    this.light = light;
    this.update();
  }

  /**
   * Updates the helper position to match the light's position.
   */
  update(): void {
    this.position.set(
      this.light.position.x,
      this.light.position.y,
      this.light.position.z,
    );
  }
}
