import type { PerspectiveCamera } from "./PerspectiveCamera";
import { Color } from "@web-real/math";
import {
  FrustumGeometry,
  type FrustumColors,
} from "../geometry/FrustumGeometry";
import { LineColorMaterial } from "../material/LineColorMaterial";
import { Mesh } from "../scene/Mesh";

export interface PerspectiveCameraHelperOptions {
  /** Color for the near plane edges. Default: yellow */
  nearColor?: Color;
  /** Color for the far plane edges. Default: orange */
  farColor?: Color;
  /** Color for the connecting edges. Default: gray */
  sideColor?: Color;
  /** Color for the lines from camera to near plane. Default: dark gray */
  coneColor?: Color;
}

/**
 * Visualizes a PerspectiveCamera's view frustum for debugging.
 *
 * @example
 * ```ts
 * const camera = new PerspectiveCamera(60, 1.5, 0.1, 100);
 * const helper = new PerspectiveCameraHelper(camera);
 * scene.add(helper);
 * ```
 */
export class PerspectiveCameraHelper extends Mesh {
  private readonly camera: PerspectiveCamera;
  private readonly frustumGeometry: FrustumGeometry;
  private readonly lineColorMaterial: LineColorMaterial;

  /**
   * Creates a new PerspectiveCameraHelper instance.
   * @param camera - The PerspectiveCamera to visualize
   * @param options - Optional colors for different frustum parts
   */
  constructor(
    camera: PerspectiveCamera,
    options: PerspectiveCameraHelperOptions = {},
  ) {
    const frustumColors: FrustumColors = {
      near: options.nearColor ?? new Color(1, 1, 0),
      far: options.farColor ?? new Color(1, 0.5, 0),
      sides: options.sideColor ?? new Color(0.5, 0.5, 0.5),
      cone: options.coneColor ?? new Color(0.3, 0.3, 0.3),
    };

    const geometry = new FrustumGeometry(camera, frustumColors);
    const material = new LineColorMaterial({
      colors: geometry.colors,
    });

    super(geometry, material);

    this.camera = camera;
    this.frustumGeometry = geometry;
    this.lineColorMaterial = material;
  }

  /**
   * Updates the frustum geometry when camera parameters change.
   * Call this after modifying camera's fov, aspect, near, or far.
   */
  update(): void {
    this.frustumGeometry.update(this.camera);
    this.lineColorMaterial.setColors(this.frustumGeometry.colors);
    this.needsUpdate = true;
  }
}
