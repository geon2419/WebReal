import { Vector3, BoundingBox, BoundingSphere } from "@web-real/math";

export interface RayTriangleIntersection {
  /** Distance from ray origin to intersection point */
  distance: number;
  /** The 3D point of intersection */
  point: Vector3;
  /** Face normal of the intersected triangle */
  faceNormal: Vector3;
}

/**
 * Represents a ray in 3D space with an origin point and direction vector.
 *
 * @example
 * ```ts
 * const ray = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, -1));
 * const point = ray.at(5); // Point 5 units along the ray
 * const intersection = ray.intersectTriangle(v0, v1, v2);
 * ```
 */
export class Ray {
  private static readonly DEFAULT_EPSILON = 1e-6;

  public origin: Vector3;
  public direction: Vector3;

  constructor(origin = new Vector3(), direction = new Vector3(0, 0, -1)) {
    this.origin = origin;
    this.direction = direction;
  }

  /**
   * Calculates a point along the ray at the specified distance from the origin.
   * @param t - Distance along the ray from the origin
   * @returns A new Vector3 at position origin + direction * t
   */
  at(t: number): Vector3 {
    return this.origin.add(this.direction.scale(t));
  }

  /**
   * Tests intersection with a triangle using the Möller–Trumbore algorithm.
   * @param vertex0 - First vertex of the triangle
   * @param vertex1 - Second vertex of the triangle
   * @param vertex2 - Third vertex of the triangle
   * @param epsilon - Tolerance for intersection tests (default: 1e-6)
   * @returns Intersection data with distance, point, and face normal, or null if no intersection
   */
  intersectTriangle(
    vertex0: Vector3,
    vertex1: Vector3,
    vertex2: Vector3,
    epsilon: number = Ray.DEFAULT_EPSILON,
  ): RayTriangleIntersection | null {
    // Calculate triangle edges
    const edge1 = vertex1.sub(vertex0);
    const edge2 = vertex2.sub(vertex0);

    // Check if ray is parallel to triangle
    const crossProduct = this.direction.cross(edge2);
    const determinant = edge1.dot(crossProduct);

    if (this._isParallelToTriangle(determinant, epsilon)) {
      return null;
    }

    // Calculate barycentric coordinates
    const inverseDeterminant = 1.0 / determinant;
    const rayToVertex = this.origin.sub(vertex0);
    const u = inverseDeterminant * rayToVertex.dot(crossProduct);

    if (!this._isValidBarycentricU(u)) {
      return null;
    }

    const secondCross = rayToVertex.cross(edge1);
    const v = inverseDeterminant * this.direction.dot(secondCross);

    if (!this._isValidBarycentricV(u, v)) {
      return null;
    }

    // Calculate intersection distance
    const t = inverseDeterminant * edge2.dot(secondCross);

    if (!this._isValidIntersectionDistance(t, epsilon)) {
      return null;
    }

    // Build intersection result
    return this._buildIntersectionResult(t, edge1, edge2);
  }

  /**
   * Checks if the ray is parallel to the triangle plane.
   * @param determinant - Determinant from Möller–Trumbore algorithm
   * @param epsilon - Tolerance value for parallel detection
   * @returns True if the ray is parallel to the triangle plane
   */
  private _isParallelToTriangle(determinant: number, epsilon: number): boolean {
    return Math.abs(determinant) < epsilon;
  }

  /**
   * Validates the first barycentric coordinate (u).
   * @param u - First barycentric coordinate
   * @returns True if u is within valid range [0, 1]
   */
  private _isValidBarycentricU(u: number): boolean {
    return u >= 0.0 && u <= 1.0;
  }

  /**
   * Validates the second barycentric coordinate (v) and ensures u + v <= 1.
   * @param u - First barycentric coordinate
   * @param v - Second barycentric coordinate
   * @returns True if v is valid and point is inside triangle
   */
  private _isValidBarycentricV(u: number, v: number): boolean {
    return v >= 0.0 && u + v <= 1.0;
  }

  /**
   * Validates the intersection distance along the ray.
   * @param t - Distance parameter along ray
   * @param epsilon - Tolerance to avoid self-intersection
   * @returns True if intersection is in front of ray origin
   */
  private _isValidIntersectionDistance(t: number, epsilon: number): boolean {
    return t > epsilon;
  }

  /**
   * Builds the intersection result with all required data.
   * @param distance - Distance from ray origin to intersection point
   * @param edge1 - First edge of triangle (vertex1 - vertex0)
   * @param edge2 - Second edge of triangle (vertex2 - vertex0)
   * @returns Complete intersection data
   */
  private _buildIntersectionResult(
    distance: number,
    edge1: Vector3,
    edge2: Vector3,
  ): RayTriangleIntersection {
    const point = this.at(distance);
    const faceNormal = edge1.cross(edge2).normalize();

    return { distance, point, faceNormal };
  }

  /**
   * Creates a copy of this ray.
   * @returns A new Ray with the same origin and direction
   */
  clone(): Ray {
    return new Ray(this.origin.clone(), this.direction.clone());
  }

  /**
   * Sets the origin and direction of this ray.
   * @param origin - The new origin point
   * @param direction - The new direction vector
   * @returns This ray instance for method chaining
   */
  set(origin: Vector3, direction: Vector3): this {
    this.origin = origin;
    this.direction = direction;
    return this;
  }

  /**
   * Tests intersection with an axis-aligned bounding box using the slab method.
   * @param box - The bounding box to test against
   * @returns Distance to the nearest intersection point, or null if no intersection
   */
  intersectBox(box: BoundingBox): number | null {
    if (box.isEmpty()) {
      return null;
    }

    const { min, max } = box;
    const { origin, direction } = this;

    let tmin = -Infinity;
    let tmax = Infinity;

    // Check each axis slab
    const xResult = this._intersectAxisSlab(
      origin.x,
      direction.x,
      min.x,
      max.x,
      tmin,
      tmax,
    );

    if (xResult === null) {
      return null;
    }

    [tmin, tmax] = xResult;

    const yResult = this._intersectAxisSlab(
      origin.y,
      direction.y,
      min.y,
      max.y,
      tmin,
      tmax,
    );

    if (yResult === null) {
      return null;
    }
    [tmin, tmax] = yResult;

    const zResult = this._intersectAxisSlab(
      origin.z,
      direction.z,
      min.z,
      max.z,
      tmin,
      tmax,
    );

    if (zResult === null) {
      return null;
    }

    [tmin, tmax] = zResult;

    // Return the nearest intersection
    return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
  }

  /**
   * Tests ray intersection against a single axis-aligned slab.
   * @param origin - Ray origin component for this axis
   * @param direction - Ray direction component for this axis
   * @param min - Minimum bound of the slab
   * @param max - Maximum bound of the slab
   * @param tmin - Current minimum intersection distance
   * @param tmax - Current maximum intersection distance
   * @returns Updated [tmin, tmax] tuple if intersection exists, or null otherwise
   */
  private _intersectAxisSlab(
    origin: number,
    direction: number,
    min: number,
    max: number,
    tmin: number,
    tmax: number,
  ): [number, number] | null {
    // Handle ray parallel to slab
    if (Math.abs(direction) < Ray.DEFAULT_EPSILON) {
      // Ray is outside the slab
      if (origin < min || origin > max) {
        return null;
      }
      // Ray is inside the slab, no change to tmin/tmax
      return [tmin, tmax];
    }

    // Calculate intersection with slab planes
    const inverseDirection = 1.0 / direction;
    let t1 = (min - origin) * inverseDirection;
    let t2 = (max - origin) * inverseDirection;

    // Ensure t1 <= t2
    if (t1 > t2) [t1, t2] = [t2, t1];

    // Update tmin and tmax
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);

    // Check for valid intersection
    return tmin > tmax ? null : [tmin, tmax];
  }

  /**
   * Tests intersection with a bounding sphere using geometric discriminant calculation.
   * @param sphere - The bounding sphere to test against
   * @returns Distance to the nearest intersection point, or null if no intersection
   */
  intersectSphere(sphere: BoundingSphere): number | null {
    if (sphere.isEmpty()) {
      return null;
    }

    const { center, radius } = sphere;
    const { origin, direction } = this;

    // Vector from ray origin to sphere center
    const originToCenter = center.sub(origin);

    // Project originToCenter onto ray direction
    const projectionDistance = originToCenter.dot(direction);

    // Distance squared from sphere center to ray
    const distanceSquared =
      originToCenter.dot(originToCenter) -
      projectionDistance * projectionDistance;
    const radiusSquared = radius * radius;

    // If distance to ray is greater than radius, no intersection
    if (distanceSquared > radiusSquared) {
      return null;
    }

    // Half-chord length
    const thc = Math.sqrt(radiusSquared - distanceSquared);

    // Two intersection points
    const t0 = projectionDistance - thc;
    const t1 = projectionDistance + thc;

    // Return the nearest intersection in front of the ray
    if (t0 >= 0) {
      return t0;
    }

    if (t1 >= 0) {
      return t1;
    }

    return null;
  }
}
