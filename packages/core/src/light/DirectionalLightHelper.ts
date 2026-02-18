import type { DirectionalLight } from "./DirectionalLight";
import { Color } from "@web-real/math";
import { LineMaterial } from "../material/LineMaterial";
import { Mesh } from "../scene/Mesh";
import type { Geometry } from "../geometry/Geometry";

export interface DirectionalLightHelperOptions {
  /** Length of the direction arrow. Default: 1 */
  size?: number;
  /** Color of the helper lines. Default: yellow */
  color?: Color;
}

/**
 * Geometry for DirectionalLightHelper - an arrow showing light direction.
 * Creates a 3-line arrow (main shaft and two arrowhead wings) pointing in the light's direction.
 */
class DirectionalLightHelperGeometry implements Geometry {
  positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array = new Uint16Array(0);
  readonly vertexCount: number;
  readonly indexCount: number = 0;

  private size: number;

  /**
   * Creates a new DirectionalLightHelperGeometry instance.
   * @param light - The DirectionalLight to visualize
   * @param size - The length of the arrow
   */
  constructor(light: DirectionalLight, size: number) {
    this.size = size;

    // Arrow: main line + arrowhead (2 lines)
    // 6 vertices for 3 lines (line-list)
    this.vertexCount = 6;
    this.positions = new Float32Array(this.vertexCount * 3);
    this.normals = new Float32Array(this.vertexCount * 3); // unused for lines

    this.updatePositions(light);
  }

  /**
   * Updates the arrow geometry based on the light's direction.
   * @param light - The DirectionalLight to update from
   */
  updatePositions(light: DirectionalLight): void {
    const dir = light.direction;
    const size = this.size;

    // Main line: from origin to direction * size
    const endX = dir.x * size;
    const endY = dir.y * size;
    const endZ = dir.z * size;

    // Arrowhead size (20% of main size)
    const headSize = size * 0.2;

    // Calculate perpendicular vectors for arrowhead
    // Find a vector not parallel to direction
    let perpX: number, perpY: number, perpZ: number;
    // Try cross with up vector (0, 1, 0)
    perpX = dir.z;
    perpY = 0;
    perpZ = -dir.x;
    let perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
    if (perpLen < 1e-6) {
      // If direction is parallel to up, cross with right vector (1, 0, 0)
      perpX = 0;
      perpY = -dir.z;
      perpZ = dir.y;
      perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
      if (perpLen < 1e-6) {
        // If still zero (direction is zero vector), default to (1,0,0)
        perpX = 1;
        perpY = 0;
        perpZ = 0;
        perpLen = 1;
      }
    }
    // Normalize
    perpX /= perpLen;
    perpY /= perpLen;
    perpZ /= perpLen;

    // Arrowhead base point (back from end)
    const baseX = endX - dir.x * headSize;
    const baseY = endY - dir.y * headSize;
    const baseZ = endZ - dir.z * headSize;

    // Arrowhead wing points
    const wing1X = baseX + perpX * headSize * 0.5;
    const wing1Y = baseY + perpY * headSize * 0.5;
    const wing1Z = baseZ + perpZ * headSize * 0.5;

    const wing2X = baseX - perpX * headSize * 0.5;
    const wing2Y = baseY - perpY * headSize * 0.5;
    const wing2Z = baseZ - perpZ * headSize * 0.5;

    // Line 1: origin to end (main shaft)
    this.positions[0] = 0;
    this.positions[1] = 0;
    this.positions[2] = 0;
    this.positions[3] = endX;
    this.positions[4] = endY;
    this.positions[5] = endZ;

    // Line 2: end to wing1 (arrowhead)
    this.positions[6] = endX;
    this.positions[7] = endY;
    this.positions[8] = endZ;
    this.positions[9] = wing1X;
    this.positions[10] = wing1Y;
    this.positions[11] = wing1Z;

    // Line 3: end to wing2 (arrowhead)
    this.positions[12] = endX;
    this.positions[13] = endY;
    this.positions[14] = endZ;
    this.positions[15] = wing2X;
    this.positions[16] = wing2Y;
    this.positions[17] = wing2Z;
  }

  /**
   * Updates the geometry to reflect changes in the light's direction.
   * @param light - The DirectionalLight to update from
   */
  update(light: DirectionalLight): void {
    this.updatePositions(light);
  }
}

/**
 * A helper class that visualizes a DirectionalLight's direction.
 * Displays an arrow pointing in the light's direction.
 *
 * @example
 * ```typescript
 * const light = new DirectionalLight(new Vector3(1, -1, 0));
 * const helper = new DirectionalLightHelper(light, {
 *   size: 2,
 *   color: Color.YELLOW,
 * });
 * scene.add(helper);
 *
 * // Update when light direction changes
 * light.direction = new Vector3(0, -1, 1).normalize();
 * helper.update();
 * ```
 */
export class DirectionalLightHelper extends Mesh {
  private readonly light: DirectionalLight;
  private readonly helperGeometry: DirectionalLightHelperGeometry;

  /**
   * Creates a new DirectionalLightHelper instance.
   * @param light - The DirectionalLight to visualize
   * @param options - Configuration options for the helper
   */
  constructor(
    light: DirectionalLight,
    options: DirectionalLightHelperOptions = {},
  ) {
    const size = options.size ?? 1;
    const color = options.color ?? new Color(1, 1, 0); // Yellow default

    const geometry = new DirectionalLightHelperGeometry(light, size);
    const material = new LineMaterial({ color });

    super(geometry, material);

    this.light = light;
    this.helperGeometry = geometry;
  }

  /**
   * Updates the helper to reflect changes in the light's direction or position.
   */
  update(): void {
    // Sync helper position with light position
    this.position.set(
      this.light.position.x,
      this.light.position.y,
      this.light.position.z,
    );
    this.helperGeometry.update(this.light);
    this.needsUpdate = true;
  }
}
