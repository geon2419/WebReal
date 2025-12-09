import { Color } from "@web-real/math";
import { Light } from "./Light";

/**
 * Represents an ambient light that uniformly illuminates all objects in the scene.
 * Ambient light has no position or direction - it provides a base level of illumination.
 *
 * @example
 * ```ts
 * const ambient = new AmbientLight(new Color(1, 1, 1), 0.3);
 * scene.add(ambient);
 * ```
 */
export class AmbientLight extends Light {
  /**
   * Creates a new AmbientLight.
   * @param color - Light color (default: white)
   * @param intensity - Light intensity multiplier (default: 0.1)
   */
  constructor(color: Color = new Color(1, 1, 1), intensity: number = 0.1) {
    super(color, intensity);
  }
}
