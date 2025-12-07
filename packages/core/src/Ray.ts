import { Vector3 } from "@web-real/math";

export interface RayTriangleIntersection {
  /** Distance from ray origin to intersection point */
  distance: number;
  /** The 3D point of intersection */
  point: Vector3;
  /** Face normal of the intersected triangle */
  faceNormal: Vector3;
}

/**
 * Represents a ray in 3D space, defined by an origin point and a direction vector.
 * Used for raycasting operations such as mouse picking and collision detection.
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
   * Gets a point along the ray at distance t from the origin.
   * @param t - Distance along the ray
   * @returns Point at origin + direction * t
   */
  at(t: number): Vector3 {
    return this.origin.add(this.direction.scale(t));
  }

  /**
   * Tests intersection between this ray and a triangle using the Möller–Trumbore algorithm.
   * @param a - First vertex of the triangle
   * @param b - Second vertex of the triangle
   * @param c - Third vertex of the triangle
   * @param epsilon - Tolerance for intersection tests (default: 1e-6)
   * @returns Intersection data if the ray intersects the triangle, null otherwise
   */
  intersectTriangle(
    a: Vector3,
    b: Vector3,
    c: Vector3,
    epsilon: number = Ray.DEFAULT_EPSILON
  ): RayTriangleIntersection | null {
    // Calculate triangle edges
    const edge1 = b.sub(a);
    const edge2 = c.sub(a);

    // Check if ray is parallel to triangle
    const h = this.direction.cross(edge2);
    const det = edge1.dot(h);

    if (this._isParallelToTriangle(det, epsilon)) {
      return null;
    }

    // Calculate barycentric coordinates
    const invDet = 1.0 / det;
    const s = this.origin.sub(a);
    const u = invDet * s.dot(h);

    if (!this._isValidBarycentricU(u)) {
      return null;
    }

    const q = s.cross(edge1);
    const v = invDet * this.direction.dot(q);

    if (!this._isValidBarycentricV(u, v)) {
      return null;
    }

    // Calculate intersection distance
    const t = invDet * edge2.dot(q);

    if (!this._isValidIntersectionDistance(t, epsilon)) {
      return null;
    }

    // Build intersection result
    return this._buildIntersectionResult(t, edge1, edge2);
  }

  /**
   * Checks if the ray is parallel to the triangle plane.
   * @param determinant - Determinant from Möller–Trumbore algorithm
   * @param epsilon - Tolerance value
   * @returns True if ray is parallel to triangle
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
   * @param edge1 - First edge of triangle (b - a)
   * @param edge2 - Second edge of triangle (c - a)
   * @returns Complete intersection data
   */
  private _buildIntersectionResult(
    distance: number,
    edge1: Vector3,
    edge2: Vector3
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
   * @param origin - New origin point
   * @param direction - New direction vector
   * @returns This ray for chaining
   */
  set(origin: Vector3, direction: Vector3): this {
    this.origin = origin;
    this.direction = direction;
    return this;
  }
}
