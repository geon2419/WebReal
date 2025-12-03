import { Object3D } from "./Object3D";

export class Scene extends Object3D {
  updateMatrixWorld(): void {
    this.updateWorldMatrix(false, true);
  }

  /**
   * Traverses all objects in the scene and executes the callback for each Object3D.
   * @param callback - Function to call for each Object3D
   */
}
