import { Color, Vector3 } from "@web-real/math";
import { Light } from "./Light";

/**
 * Represents a directional light that emits parallel rays in a specific direction.
 * Similar to sunlight, where all light rays are parallel regardless of distance.
 *
 * @example
 * ```ts
 * const sunlight = new DirectionalLight(
 *   new Vector3(1, -1, 0).normalize(),
 *   new Color(1, 0.95, 0.8),
 *   1.2
 * );
 * scene.add(sunlight);
 * ```
 */
export class DirectionalLight extends Light {
  public direction: Vector3;

  /**
   * Creates a new DirectionalLight instance.
   * @param direction - The direction vector for the light (will be normalized, default: downward)
   * @param color - The color of the light (default: white)
   * @param intensity - The intensity multiplier for the light (default: 1)
   * @throws Error if direction vector is zero
   */
  constructor(
    direction: Vector3 = new Vector3(0, -1, 0),
    color: Color = new Color(1, 1, 1),
    intensity: number = 1,
  ) {
    super(color, intensity);
    if (direction.length < 1e-8) {
      throw new Error("DirectionalLight: direction vector must be non-zero.");
    }
    this.direction = direction.normalize();
  }
}
