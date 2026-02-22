import { Object3D } from "./Object3D";
import type { Light } from "../light/Light";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";

/**
 * Represents a 3D scene graph that contains objects and lights.
 *
 * @example
 * ```ts
 * const scene = new Scene();
 * const mesh = new Mesh(geometry, material);
 * scene.add(mesh);
 * ```
 */
export class Scene extends Object3D {
  /**
   * Disposes resources owned by this scene.
   * @example
   * ```ts
   * engine.stop();
   * scene.dispose();
   * ```
   */
  dispose(): void {}

  /**
   * Updates the world transformation matrices for this scene and all children.
   */
  updateMatrixWorld(): void {
    this.updateWorldMatrix(false, true);
  }

  /**
   * Finds the first light of the specified type in the scene graph.
   * @param type - Optional light constructor to filter by
   * @returns The first matching light, or undefined if not found
   */
  findFirstLight<T extends Light = Light>(
    type?: new (...args: any[]) => T,
  ): T | undefined {
    let light: T | undefined;
    this.traverse((obj) => {
      if (
        !light &&
        (obj instanceof DirectionalLight || obj instanceof PointLight)
      ) {
        if (!type || obj instanceof type) {
          light = obj as unknown as T;
        }
      }
    });
    return light;
  }
}
