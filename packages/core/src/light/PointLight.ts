import { Color } from "@web-real/math";
import { Light } from "./Light";

/**
 * Attenuation type for point light falloff calculation.
 * - 'linear': Simple linear falloff (1 - distance/range)
 * - 'quadratic': Smooth quadratic falloff ((1 - distance/range)²)
 * - 'physical': Physically-based inverse square falloff (1 / (1 + distance²))
 */
export type AttenuationType = "linear" | "quadratic" | "physical";

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
    attenuationType: AttenuationType = "quadratic"
  ) {
    super(color, intensity);
    this.range = range;
    this.attenuationType = attenuationType;
  }

  /**
   * Returns attenuation factors based on the attenuation type.
   * The returned tuple is used by the shader to determine attenuation based on the selected type.
   * For 'linear' and 'quadratic', the shader uses custom falloff formulas; for 'physical', an inverse-square-like formula is used.
   * See the shader implementation (e.g., BlinnPhongMaterial.ts) for details on how these values are used.
   * @returns Tuple of [range, parameter, unused, attenuation type code] for use in the shader.
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
