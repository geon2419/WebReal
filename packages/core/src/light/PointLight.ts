import { Color } from "@web-real/math";
import { Light } from "./Light";

/**
 * Attenuation type for point light falloff calculation.
 * - 'linear': Simple linear falloff (1 - distance/range)
 * - 'quadratic': Smooth quadratic falloff ((1 - distance/range)²)
 * - 'physical': Physically-based inverse square falloff (1 / (1 + distance²))
 */
export type AttenuationType = "linear" | "quadratic" | "physical";

/**
 * Represents a point light that emits light in all directions from a single point.
 * Light intensity decreases with distance based on the chosen attenuation type.
 *
 * @example
 * ```ts
 * const bulb = new PointLight(new Color(1, 0.8, 0.5), 2.0, 15, 'quadratic');
 * bulb.position.set(0, 3, 0);
 * scene.add(bulb);
 * ```
 */
export class PointLight extends Light {
  /** Maximum range of the light. Objects beyond this distance receive no light. */
  public range: number;
  /** Attenuation type for falloff calculation. */
  public attenuationType: AttenuationType;

  /**
   * Creates a new PointLight.
   * @param color - Light color (default: white)
   * @param intensity - Light intensity multiplier (default: 1)
   * @param range - Maximum light range (default: 10)
   * @param attenuationType - Attenuation falloff type (default: 'quadratic')
   */
  constructor(
    color: Color = new Color(1, 1, 1),
    intensity: number = 1,
    range: number = 10,
    attenuationType: AttenuationType = "quadratic",
  ) {
    super(color, intensity);
    this.range = range;
    this.attenuationType = attenuationType;
  }

  /**
   * Returns attenuation factors for shader-based falloff calculation.
   * @returns Tuple of [range, parameter, unused, type code] where type code is 0 (linear), 1 (quadratic), or 2 (physical)
   */
  getAttenuationFactors(): [number, number, number, number] {
    // Encode attenuation type: 0 = linear, 1 = quadratic, 2 = physical
    const typeCode =
      this.attenuationType === "linear"
        ? 0
        : this.attenuationType === "quadratic"
          ? 1
          : 2;

    switch (this.attenuationType) {
      case "linear":
        // Linear falloff: 1 - d/range
        return [this.range, 0, 0, typeCode];
      case "quadratic":
        // Quadratic falloff: (1 - d/range)²
        return [this.range, 0, 0, typeCode];
      case "physical":
        // Physical inverse square: 1 / (1 + (d/range)² * k)
        // Using k=16 for reasonable falloff at range boundary
        return [this.range, 16, 0, typeCode];
    }
  }
}
