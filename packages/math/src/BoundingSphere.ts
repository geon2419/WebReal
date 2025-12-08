import { Vector3 } from "./Vector3";
import { BoundingBox } from "./BoundingBox";

/**
 * Bounding Sphere for 3D objects.
 * Used for efficient culling and intersection tests.
 */
export class BoundingSphere {
  /** Center point of the sphere */
  public center: Vector3;
  /** Radius of the sphere */
  public radius: number;

  /**
   * Creates a new BoundingSphere.
   * @param center - Center point (defaults to origin)
   * @param radius - Radius (defaults to -1, indicating empty sphere)
   */
  constructor(center = new Vector3(), radius = -1) {
    this.center = center;
    this.radius = radius;
  }

  /**
   * Creates a BoundingSphere from a Float32Array of positions.
   * Uses AABB-based algorithm: creates a bounding box first, then computes
   * the sphere from the box center and the farthest vertex.
   * This is fast but may not produce the minimal bounding sphere.
   *
   * @param positions - Vertex positions with stride 3 (x, y, z)
   * @returns A BoundingSphere that contains all positions
   */
  static fromPositions(positions: Float32Array): BoundingSphere {
    if (positions.length === 0) {
      return new BoundingSphere();
    }

    // First, compute AABB
    const box = BoundingBox.fromPositions(positions);
    const center = box.getCenter();

    // Find the maximum distance from center to any vertex
    // Reuse a single Vector3 to avoid memory allocation in the loop
    let maxRadiusSquared = 0;
    const point = new Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      point.set(positions[i], positions[i + 1], positions[i + 2]);
      const distSquared = center.distanceToSquared(point);
      maxRadiusSquared = Math.max(maxRadiusSquared, distSquared);
    }

    return new BoundingSphere(center, Math.sqrt(maxRadiusSquared));
  }

  /**
   * Creates a BoundingSphere from a BoundingBox.
   * The sphere is centered at the box center with radius equal to
   * half the box diagonal length.
   *
   * @param box - The bounding box
   * @returns A BoundingSphere that contains the box
   */
  static fromBoundingBox(box: BoundingBox): BoundingSphere {
    const center = box.getCenter();
    const size = box.getSize();
    const radius = size.length * 0.5;
    return new BoundingSphere(center, radius);
  }

  /**
   * Tests if a point is inside the bounding sphere.
   * @param point - The point to test
   * @returns True if the point is inside or on the boundary
   */
  containsPoint(point: Vector3): boolean {
    return this.center.distanceToSquared(point) <= this.radius * this.radius;
  }

  /**
   * Tests if this sphere intersects another sphere.
   * @param sphere - The other bounding sphere
   * @returns True if the spheres overlap
   */
  intersectsSphere(sphere: BoundingSphere): boolean {
    const radiusSum = this.radius + sphere.radius;
    return (
      this.center.distanceToSquared(sphere.center) <= radiusSum * radiusSum
    );
  }

  /**
   * Creates a copy of this bounding sphere.
   */
  clone(): BoundingSphere {
    return new BoundingSphere(this.center.clone(), this.radius);
  }

  /**
   * Checks if the sphere is empty (negative radius).
   * Note: A radius of 0 represents a valid degenerate sphere (a single point)
   * and is not considered empty.
   */
  isEmpty(): boolean {
    return this.radius < 0;
  }
}
