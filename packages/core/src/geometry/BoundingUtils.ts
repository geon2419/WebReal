import { BoundingBox, BoundingSphere } from "@web-real/math";
import type { Geometry } from "./Geometry";

/**
 * Computes an axis-aligned bounding box (AABB) for a geometry.
 * The box is computed from the geometry's vertex positions.
 *
 * @param geometry - The geometry to compute the bounding box for
 * @returns A BoundingBox that contains all vertices of the geometry
 */
export function computeBoundingBox(geometry: Geometry): BoundingBox {
  return BoundingBox.fromPositions(geometry.positions);
}

/**
 * Computes a bounding sphere for a geometry.
 * Uses an AABB-based algorithm for performance.
 *
 * @param geometry - The geometry to compute the bounding sphere for
 * @returns A BoundingSphere that contains all vertices of the geometry
 */
export function computeBoundingSphere(geometry: Geometry): BoundingSphere {
  return BoundingSphere.fromPositions(geometry.positions);
}
