import type { OrthographicCamera } from "./OrthographicCamera";
import { Color } from "@web-real/math";
import {
  FrustumGeometry,
  type FrustumColors,
} from "../geometry/FrustumGeometry";
import { LineColorMaterial } from "../material/LineColorMaterial";
import { Mesh } from "../Mesh";

export interface OrthographicCameraHelperOptions {
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
 * A helper class that visualizes an OrthographicCamera's view frustum.
 * Useful for debugging camera setup and understanding the visible area.
 *
 * Different colors are used for different parts of the frustum:
 * - Near plane edges (default: yellow)
 * - Far plane edges (default: orange)
 * - Side edges connecting near to far (default: gray)
 * - Cone lines from camera position to near plane (default: dark gray)
 *
 * @example
 * ```typescript
 * const debugCamera = new OrthographicCamera({
 *   left: -10,
 *   right: 10,
 *   top: 10,
 *   bottom: -10,
 *   near: 0.1,
 *   far: 100,
 * });
 * const helper = new OrthographicCameraHelper(debugCamera, {
 *   nearColor: Color.GREEN,
 *   farColor: Color.RED,
 *   sideColor: Color.BLUE,
 *   coneColor: Color.WHITE,
 * });
 * scene.add(helper);
 *
 * // Update when camera parameters change
 * debugCamera.zoom = 2;
 * helper.update();
 * ```
 */
export class OrthographicCameraHelper extends Mesh {
  private readonly camera: OrthographicCamera;
  private readonly frustumGeometry: FrustumGeometry;
  private readonly lineColorMaterial: LineColorMaterial;

  constructor(
    camera: OrthographicCamera,
    options: OrthographicCameraHelperOptions = {}
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
   * Call this after modifying camera's zoom, left, right, top, bottom, near, or far.
   */
  update(): void {
    this.frustumGeometry.update(this.camera);
    this.lineColorMaterial.setColors(this.frustumGeometry.colors);
    this.needsUpdate = true;
  }
}
