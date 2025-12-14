import { Matrix4, Vector3 } from "@web-real/math";

/**
 * Represents a node in the 3D scene graph with transform properties and parent-child hierarchy.
 *
 * @example
 * ```ts
 * const parent = new Object3D();
 * const child = new Object3D();
 * parent.add(child);
 * child.position = new Vector3(1, 2, 3);
 * parent.updateWorldMatrix();
 * ```
 */
export class Object3D {
  private _position: Vector3 = new Vector3(0, 0, 0);
  private _rotation: Vector3 = new Vector3(0, 0, 0);
  private _scale: Vector3 = new Vector3(1, 1, 1);
  public parent: Object3D | null = null;
  public readonly children: Object3D[] = [];
  /** Whether this object is visible and should be rendered */
  public visible: boolean = true;
  /** Local transformation matrix (TRS) */
  public readonly localMatrix: Matrix4 = new Matrix4();
  /** World transformation matrix (includes parent transforms) */
  public readonly worldMatrix: Matrix4 = new Matrix4();

  /**
   * Gets the local position of this object in 3D space.
   * @returns The position vector
   */
  get position(): Vector3 {
    return this._position;
  }

  set position(value: Vector3) {
    this._position = value;
  }

  /**
   * Gets the local rotation of this object in radians (Euler angles).
   * @returns The rotation vector (x, y, z)
   */
  get rotation(): Vector3 {
    return this._rotation;
  }

  set rotation(value: Vector3) {
    this._rotation = value;
  }

  /**
   * Gets the local scale of this object.
   * @returns The scale vector (x, y, z)
   */
  get scale(): Vector3 {
    return this._scale;
  }

  set scale(value: Vector3) {
    this._scale = value;
  }

  /**
   * Adds a child object to this object's hierarchy.
   * @param child - The object to add as a child
   * @returns This object for method chaining
   */
  add(child: Object3D): this {
    if (child.parent !== null) {
      child.parent.remove(child);
    }
    child.parent = this;
    this.children.push(child);
    return this;
  }

  /**
   * Removes a child object from this object's hierarchy.
   * @param child - The object to remove
   * @returns This object for method chaining
   */
  remove(child: Object3D): this {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.parent = null;
      this.children.splice(index, 1);
    }
    return this;
  }

  /**
   * Updates the local matrix from position, rotation, and scale.
   * Applies transformations in TRS order (Scale -> Rotate -> Translate).
   * Rotation is applied in ZYX order.
   */
  updateMatrix(): void {
    const scaleMatrix = Matrix4.scaling(this.scale);

    const rotX = Matrix4.rotationX(this.rotation.x);
    const rotY = Matrix4.rotationY(this.rotation.y);
    const rotZ = Matrix4.rotationZ(this.rotation.z);
    const rotationMatrix = rotZ.multiply(rotY).multiply(rotX);

    const translationMatrix = Matrix4.translation(this.position);

    const result = translationMatrix
      .multiply(rotationMatrix)
      .multiply(scaleMatrix);
    this.localMatrix.data.set(result.data);
  }

  /**
   * Updates the world matrix by combining parent's world matrix with local matrix.
   * @param updateParents - Whether to update parent chain first (default: false)
   * @param updateChildren - Whether to recursively update children (default: true)
   */
  updateWorldMatrix(updateParents = false, updateChildren = true): void {
    // Optionally update parent chain first
    if (updateParents && this.parent !== null) {
      this.parent.updateWorldMatrix(true, false);
    }

    this.updateMatrix();

    // Compute world matrix
    if (this.parent === null) {
      this.worldMatrix.data.set(this.localMatrix.data);
    } else {
      const result = this.parent.worldMatrix.multiply(this.localMatrix);
      this.worldMatrix.data.set(result.data);
    }

    if (updateChildren) {
      for (const child of this.children) {
        child.updateWorldMatrix(false, true);
      }
    }
  }

  /**
   * Recursively traverses this object and all children, executing a callback on each.
   * @param callback - Function to call for each object in the hierarchy
   */
  traverse(callback: (object: Object3D) => void): void {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  /**
   * Recursively disposes this object and all children in the hierarchy.
   *
   * @example
   * ```ts
   * // Cleanup entire scene graph
   * scene.disposeHierarchy();
   * ```
   */
  disposeHierarchy(): void {
    // Dispose children first (depth-first)
    for (const child of [...this.children]) {
      child.disposeHierarchy();
    }

    // Dispose self if the method exists
    if ("dispose" in this && typeof (this as any).dispose === "function") {
      (this as any).dispose();
    }

    // Clear parent/child relationships
    this.children.length = 0;
    if (this.parent) {
      this.parent.remove(this);
    }
  }
}
