import { Vector3 } from "./Vector3";

/**
 * Represents an Axis-Aligned Bounding Box (AABB) aligned with coordinate axes.
 *
 * @example
 * ```ts
 * const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(10, 10, 10));
 * const center = box.getCenter(); // Vector3(5, 5, 5)
 * const size = box.getSize(); // Vector3(10, 10, 10)
 * ```
 */
export class BoundingBox {
  /** Minimum corner of the box */
  public min: Vector3;
  /** Maximum corner of the box */
  public max: Vector3;

  /**
   * Creates a new BoundingBox.
   * @param min - Minimum corner (defaults to positive infinity)
   * @param max - Maximum corner (defaults to negative infinity)
   */
  constructor(
    min = new Vector3(Infinity, Infinity, Infinity),
    max = new Vector3(-Infinity, -Infinity, -Infinity),
  ) {
    this.min = min;
    this.max = max;
  }

  /**
   * Creates a BoundingBox from a Float32Array of positions.
   * @param positions - Vertex positions with stride 3 (x, y, z)
   * @returns A BoundingBox that contains all positions
   */
  static fromPositions(positions: Float32Array): BoundingBox {
    if (positions.length === 0) {
      return new BoundingBox();
    }

    const box = new BoundingBox();

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      box.min.x = Math.min(box.min.x, x);
      box.min.y = Math.min(box.min.y, y);
      box.min.z = Math.min(box.min.z, z);

      box.max.x = Math.max(box.max.x, x);
      box.max.y = Math.max(box.max.y, y);
      box.max.z = Math.max(box.max.z, z);
    }

    return box;
  }

  /**
   * Tests if a point is inside the bounding box.
   * @param point - The point to test
   * @returns True if the point is inside or on the boundary
   */
  containsPoint(point: Vector3): boolean {
    return (
      point.x >= this.min.x &&
      point.x <= this.max.x &&
      point.y >= this.min.y &&
      point.y <= this.max.y &&
      point.z >= this.min.z &&
      point.z <= this.max.z
    );
  }

  /**
   * Tests if this box intersects another box.
   * @param box - The other bounding box
   * @returns True if the boxes overlap
   */
  intersectsBox(box: BoundingBox): boolean {
    return !(
      this.max.x < box.min.x ||
      this.min.x > box.max.x ||
      this.max.y < box.min.y ||
      this.min.y > box.max.y ||
      this.max.z < box.min.z ||
      this.min.z > box.max.z
    );
  }

  /**
   * Calculates the center point of the bounding box.
   * @returns A new Vector3 at the center of the box
   */
  getCenter(): Vector3 {
    return new Vector3(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5,
      (this.min.z + this.max.z) * 0.5,
    );
  }

  /**
   * Calculates the size (dimensions) of the bounding box.
   * @returns A new Vector3 representing width, height, and depth
   */
  getSize(): Vector3 {
    return new Vector3(
      this.max.x - this.min.x,
      this.max.y - this.min.y,
      this.max.z - this.min.z,
    );
  }

  /**
   * Expands the box to include the given point.
   * @param point - The point to include
   * @returns This bounding box for chaining
   */
  expandByPoint(point: Vector3): this {
    this.min.set(
      Math.min(this.min.x, point.x),
      Math.min(this.min.y, point.y),
      Math.min(this.min.z, point.z),
    );
    this.max.set(
      Math.max(this.max.x, point.x),
      Math.max(this.max.y, point.y),
      Math.max(this.max.z, point.z),
    );
    return this;
  }

  /**
   * Returns a new bounding box that contains both this box and another box.
   * @param box - The other bounding box
   * @returns A new BoundingBox
   */
  union(box: BoundingBox): BoundingBox {
    return new BoundingBox(
      Vector3.min(this.min, box.min),
      Vector3.max(this.max, box.max),
    );
  }

  /**
   * Creates a deep copy of this bounding box.
   * @returns A new BoundingBox with cloned min and max vectors
   */
  clone(): BoundingBox {
    return new BoundingBox(this.min.clone(), this.max.clone());
  }

  /**
   * Checks if the box is empty (has inverted min/max coordinates).
   * @returns True if any max coordinate is less than its corresponding min
   */
  isEmpty(): boolean {
    return (
      this.max.x < this.min.x ||
      this.max.y < this.min.y ||
      this.max.z < this.min.z
    );
  }
}
