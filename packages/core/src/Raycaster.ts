import { Vector2, Vector3 } from "@web-real/math";
import { Ray } from "./Ray";
import type { Camera } from "./camera/Camera";
import type { PerspectiveCamera } from "./camera/PerspectiveCamera";
import type { Object3D } from "./Object3D";
import type { Mesh } from "./Mesh";

export interface Intersection {
  /** Distance from ray origin to intersection point */
  distance: number;
  /** 3D point of intersection in world space */
  point: Vector3;
  /** The object that was intersected */
  object: Mesh;
  /** Index of the intersected face (triangle) */
  faceIndex: number;
  /** Face normal at the intersection point */
  normal: Vector3;
  /** UV coordinates at intersection (undefined if geometry has no UVs) */
  uv?: Vector2;
}

/**
 * Raycaster for performing ray intersection tests with 3D objects.
 * Commonly used for mouse picking and collision detection.
 */
export class Raycaster {
  public ray: Ray;
  public near: number;
  public far: number;

  constructor(origin?: Vector3, direction?: Vector3, near = 0, far = Infinity) {
    this.ray = new Ray(origin, direction);
    this.near = near;
    this.far = far;
  }

  /**
   * Sets the ray from camera and normalized device coordinates (NDC).
   * @param coords - Mouse position in NDC (-1 to +1 for both x and y)
   * @param camera - The camera to cast the ray from
   * @returns This raycaster for chaining
   */
  setFromCamera(coords: Vector2, camera: Camera): this {
    // Update camera matrices
    camera.updateWorldMatrix(true, false);

    // Get inverse projection matrix
    const projectionMatrixInverse = camera.projectionMatrix.inverse();
    const viewMatrixInverse = camera.viewMatrix.inverse();

    // Check camera type
    if ((camera as PerspectiveCamera).fov !== undefined) {
      // Perspective camera
      // Ray origin is camera position
      const cameraWorldMatrix = camera.worldMatrix;
      const cameraPosition = new Vector3(
        cameraWorldMatrix.data[12],
        cameraWorldMatrix.data[13],
        cameraWorldMatrix.data[14]
      );

      // Transform NDC to camera space
      // For perspective, we use near plane (z = -1 in NDC)
      const rayOriginNDC = new Vector3(coords.x, coords.y, -1);
      const rayOriginCamera =
        projectionMatrixInverse.transformPoint(rayOriginNDC);

      // Transform to world space
      const rayOriginWorld = viewMatrixInverse.transformPoint(rayOriginCamera);

      // Direction is from camera to point on near plane
      const direction = rayOriginWorld.sub(cameraPosition).normalize();

      this.ray.set(cameraPosition, direction);
    } else {
      // Orthographic camera
      // Ray direction is camera's forward direction
      const rayOriginNDC = new Vector3(coords.x, coords.y, -1);
      const rayTargetNDC = new Vector3(coords.x, coords.y, 1);

      // Transform both points to world space
      const rayOriginCamera =
        projectionMatrixInverse.transformPoint(rayOriginNDC);
      const rayTargetCamera =
        projectionMatrixInverse.transformPoint(rayTargetNDC);

      const rayOriginWorld = viewMatrixInverse.transformPoint(rayOriginCamera);
      const rayTargetWorld = viewMatrixInverse.transformPoint(rayTargetCamera);

      // Direction from near to far
      const direction = rayTargetWorld.sub(rayOriginWorld).normalize();

      this.ray.set(rayOriginWorld, direction);
    }

    return this;
  }

  /**
   * Checks intersections with a single object and optionally its children.
   * @param object - The object to test for intersections
   * @param recursive - Whether to test children recursively
   * @returns Array of intersections, sorted by distance (closest first)
   */
  intersectObject(object: Object3D, recursive = false): Intersection[] {
    const intersections: Intersection[] = [];

    this._intersectObject(object, intersections);

    if (recursive) {
      for (const child of object.children) {
        this.intersectObject(child, recursive).forEach((intersection) => {
          intersections.push(intersection);
        });
      }
    }

    // Sort by distance
    intersections.sort((a, b) => a.distance - b.distance);

    return intersections;
  }

  /**
   * Checks intersections with multiple objects.
   * @param objects - Array of objects to test
   * @param recursive - Whether to test children recursively
   * @returns Array of intersections, sorted by distance (closest first)
   */
  intersectObjects(objects: Object3D[], recursive = false): Intersection[] {
    const intersections: Intersection[] = [];

    for (const object of objects) {
      this.intersectObject(object, recursive).forEach((intersection) => {
        intersections.push(intersection);
      });
    }

    // Sort by distance
    intersections.sort((a, b) => a.distance - b.distance);

    return intersections;
  }

  /**
   * Internal method to test intersection with a single object.
   */
  private _intersectObject(
    object: Object3D,
    intersections: Intersection[]
  ): void {
    // Only test Mesh objects
    if (!(object as Mesh).geometry) {
      return;
    }

    const mesh = object as Mesh;

    // Skip invisible objects
    if (!mesh.visible) {
      return;
    }

    // Update world matrix
    mesh.updateWorldMatrix(true, false);

    // Transform ray to local space
    const worldMatrixInverse = mesh.worldMatrix.inverse();
    const localRayOrigin = worldMatrixInverse.transformPoint(this.ray.origin);
    const localRayDirection = worldMatrixInverse
      .transformDirection(this.ray.direction)
      .normalize();

    const localRay = new Ray(localRayOrigin, localRayDirection);

    // Test all triangles
    const { positions, indices, uvs } = mesh.geometry;
    const hasUVs = uvs !== undefined;

    for (let i = 0; i < indices.length; i += 3) {
      const faceIndex = Math.floor(i / 3);

      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      const v0 = new Vector3(
        positions[i0 * 3],
        positions[i0 * 3 + 1],
        positions[i0 * 3 + 2]
      );
      const v1 = new Vector3(
        positions[i1 * 3],
        positions[i1 * 3 + 1],
        positions[i1 * 3 + 2]
      );
      const v2 = new Vector3(
        positions[i2 * 3],
        positions[i2 * 3 + 1],
        positions[i2 * 3 + 2]
      );

      const intersection = localRay.intersectTriangle(v0, v1, v2);

      if (intersection) {
        const { t, point, faceNormal } = intersection;

        // Transform point and normal back to world space
        const worldPoint = mesh.worldMatrix.transformPoint(point);
        const worldNormal = mesh.worldMatrix
          .transformDirection(faceNormal)
          .normalize();

        // Calculate distance in world space
        const distance = this.ray.origin.sub(worldPoint).length;

        // Check distance constraints in world space
        if (distance < this.near || distance > this.far) {
          continue;
        }

        // Calculate UV if available
        let uv: Vector2 | undefined = undefined;
        if (hasUVs && uvs) {
          // Calculate barycentric coordinates
          const edge1 = v1.sub(v0);
          const edge2 = v2.sub(v0);
          const pointLocal = point.sub(v0);

          const d00 = edge1.dot(edge1);
          const d01 = edge1.dot(edge2);
          const d11 = edge2.dot(edge2);
          const d20 = pointLocal.dot(edge1);
          const d21 = pointLocal.dot(edge2);

          const denom = d00 * d11 - d01 * d01;
          if (Math.abs(denom) > 1e-10) {
            const v = (d11 * d20 - d01 * d21) / denom;
            const w = (d00 * d21 - d01 * d20) / denom;
            const u = 1.0 - v - w;

            // Interpolate UVs
            const uv0 = new Vector2(uvs[i0 * 2], uvs[i0 * 2 + 1]);
            const uv1 = new Vector2(uvs[i1 * 2], uvs[i1 * 2 + 1]);
            const uv2 = new Vector2(uvs[i2 * 2], uvs[i2 * 2 + 1]);

            const uvX = uv0.x * u + uv1.x * v + uv2.x * w;
            const uvY = uv0.y * u + uv1.y * v + uv2.y * w;

            uv = new Vector2(uvX, uvY);
          }
        }

        intersections.push({
          distance,
          point: worldPoint,
          object: mesh,
          faceIndex,
          normal: worldNormal,
          uv,
        });
      }
    }
  }
}
