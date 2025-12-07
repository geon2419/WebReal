import { Vector2 } from "./Vector2";
import { Vector3 } from "./Vector3";

/**
 * Utility class for calculating barycentric coordinates and performing interpolation.
 * Barycentric coordinates are a coordinate system used to express any point inside a triangle
 * as a weighted combination of the triangle's vertices.
 *
 * Used for:
 * - UV coordinate interpolation
 * - Normal interpolation
 * - Texture sampling
 * - Physics collision response
 * - Mesh skinning and animation
 */
export class BarycentricCoordinates {
  /**
   * Calculates barycentric coordinates for a point within a triangle.
   *
   * Given a triangle defined by vertices v0, v1, v2 and a point inside the triangle,
   * calculates the barycentric coordinates (u, v, w) where:
   * - point = u * v0 + v * v1 + w * v2
   * - u + v + w = 1
   *
   * @param point - The point to calculate coordinates for
   * @param v0 - First vertex of the triangle
   * @param v1 - Second vertex of the triangle
   * @param v2 - Third vertex of the triangle
   * @returns Object with u, v, w coordinates or null if calculation fails
   */
  static calculate(
    point: Vector3,
    v0: Vector3,
    v1: Vector3,
    v2: Vector3
  ): { u: number; v: number; w: number } | null {
    const edge1 = v1.sub(v0);
    const edge2 = v2.sub(v0);
    const pointLocal = point.sub(v0);

    const d00 = edge1.dot(edge1);
    const d01 = edge1.dot(edge2);
    const d11 = edge2.dot(edge2);
    const d20 = pointLocal.dot(edge1);
    const d21 = pointLocal.dot(edge2);

    const denom = d00 * d11 - d01 * d01;
    if (Math.abs(denom) < 1e-10) {
      return null;
    }

    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1.0 - v - w;

    return { u, v, w };
  }

  /**
   * Interpolates UV coordinates using barycentric coordinates.
   *
   * @param barycentric - The barycentric coordinates (u, v, w)
   * @param uv0 - UV coordinates at first vertex
   * @param uv1 - UV coordinates at second vertex
   * @param uv2 - UV coordinates at third vertex
   * @returns Interpolated UV coordinates
   */
  static interpolateUV(
    barycentric: { u: number; v: number; w: number },
    uv0: Vector2,
    uv1: Vector2,
    uv2: Vector2
  ): Vector2 {
    const { u, v, w } = barycentric;
    const uvX = uv0.x * u + uv1.x * v + uv2.x * w;
    const uvY = uv0.y * u + uv1.y * v + uv2.y * w;
    return new Vector2(uvX, uvY);
  }

  /**
   * Interpolates a Vector3 attribute using barycentric coordinates.
   *
   * @param barycentric - The barycentric coordinates (u, v, w)
   * @param attr0 - Attribute value at first vertex
   * @param attr1 - Attribute value at second vertex
   * @param attr2 - Attribute value at third vertex
   * @returns Interpolated Vector3 attribute
   */
  static interpolateVector3(
    barycentric: { u: number; v: number; w: number },
    attr0: Vector3,
    attr1: Vector3,
    attr2: Vector3
  ): Vector3 {
    const { u, v, w } = barycentric;
    return new Vector3(
      attr0.x * u + attr1.x * v + attr2.x * w,
      attr0.y * u + attr1.y * v + attr2.y * w,
      attr0.z * u + attr1.z * v + attr2.z * w
    );
  }

  /**
   * Interpolates a scalar value using barycentric coordinates.
   *
   * @param barycentric - The barycentric coordinates (u, v, w)
   * @param val0 - Value at first vertex
   * @param val1 - Value at second vertex
   * @param val2 - Value at third vertex
   * @returns Interpolated scalar value
   */
  static interpolateScalar(
    barycentric: { u: number; v: number; w: number },
    val0: number,
    val1: number,
    val2: number
  ): number {
    const { u, v, w } = barycentric;
    return val0 * u + val1 * v + val2 * w;
  }
}
