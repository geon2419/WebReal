import { Matrix4, Vector3 } from "@web-real-3d/math";
import { Object3D } from "../Object3D";

export abstract class Camera extends Object3D {
  protected _target: Vector3 = new Vector3(0, 0, 0);
  protected _up: Vector3 = new Vector3(0, 1, 0);

  get viewMatrix(): Matrix4 {
    const e = this.worldMatrix.data;
    const worldPosition = new Vector3(e[12], e[13], e[14]);
    return Matrix4.lookAt(worldPosition, this._target, this._up);
  }

  abstract get projectionMatrix(): Matrix4;

  /**
   * Sets the camera to look at a target position.
   * @param target - The point in world space to look at
   */
  lookAt(target: Vector3): this {
    this._target.set(target.x, target.y, target.z);
    return this;
  }

  setUp(up: Vector3): this {
    this._up.set(up.x, up.y, up.z);
    return this;
  }

  get target(): Vector3 {
    return this._target;
  }

  get up(): Vector3 {
    return this._up;
  }
}
