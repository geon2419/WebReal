import { Color } from "@web-real/math";
import { Object3D } from "../Object3D";

export abstract class Light extends Object3D {
  public color: Color;
  public intensity: number;

  constructor(color: Color = new Color(1, 1, 1), intensity: number = 1) {
    super();
    this.color = color;
    this.intensity = intensity;
  }
}
