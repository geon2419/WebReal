import { BarycentricCoordinates, Vector2, Vector3 } from "@web-real/math";
import { Ray } from "./Ray";
import type { Camera } from "./camera/Camera";
import type { PerspectiveCamera } from "./camera/PerspectiveCamera";
import type { Object3D } from "./Object3D";
import type { Mesh } from "./Mesh";

/**
 * Helper class for creating rays from camera and screen coordinates.
 * Follows Single Responsibility Principle by handling only ray creation.
 */
class CameraRayHelper {
  /**
   * Creates a ray from camera and normalized device coordinates.
   */
  static createRayFromCamera(coords: Vector2, camera: Camera): Ray {
    // Update camera matrices
    camera.updateWorldMatrix(true, false);

    const projectionMatrixInverse = camera.projectionMatrix.inverse();
    const viewMatrixInverse = camera.viewMatrix.inverse();

    if ((camera as PerspectiveCamera).fov !== undefined) {
      return this._createPerspectiveRay(
        coords,
        camera,
        projectionMatrixInverse,
        viewMatrixInverse
      );
    } else {
      return this._createOrthographicRay(
        coords,
        projectionMatrixInverse,
        viewMatrixInverse
      );
    }
  }

  private static _createPerspectiveRay(
    coords: Vector2,
    camera: Camera,
    projectionMatrixInverse: any,
    viewMatrixInverse: any
  ): Ray {
    // Ray origin is camera position
    const cameraWorldMatrix = camera.worldMatrix;
    const cameraPosition = new Vector3(
      cameraWorldMatrix.data[12],
      cameraWorldMatrix.data[13],
      cameraWorldMatrix.data[14]
    );

    // Transform NDC to world space
    const rayOriginNDC = new Vector3(coords.x, coords.y, -1);
    const rayOriginCamera =
      projectionMatrixInverse.transformPoint(rayOriginNDC);
    const rayOriginWorld = viewMatrixInverse.transformPoint(rayOriginCamera);

    // Direction is from camera to point on near plane
    const direction = rayOriginWorld.sub(cameraPosition).normalize();

    return new Ray(cameraPosition, direction);
  }

  private static _createOrthographicRay(
    coords: Vector2,
    projectionMatrixInverse: any,
    viewMatrixInverse: any
  ): Ray {
    // Transform both near and far points to world space
    const rayOriginNDC = new Vector3(coords.x, coords.y, -1);
    const rayTargetNDC = new Vector3(coords.x, coords.y, 1);

    const rayOriginCamera =
      projectionMatrixInverse.transformPoint(rayOriginNDC);
    const rayTargetCamera =
      projectionMatrixInverse.transformPoint(rayTargetNDC);

    const rayOriginWorld = viewMatrixInverse.transformPoint(rayOriginCamera);
    const rayTargetWorld = viewMatrixInverse.transformPoint(rayTargetCamera);

    // Direction from near to far
    const direction = rayTargetWorld.sub(rayOriginWorld).normalize();

    return new Ray(rayOriginWorld, direction);
  }
}

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
 * Helper class for calculating mesh intersections.
 * Follows Single Responsibility Principle by handling only intersection calculations.
 */
class IntersectionCalculator {
  /**
   * Calculates intersections between a ray and a mesh.
   */
  static calculateMeshIntersections(
    ray: Ray,
    mesh: Mesh,
    near: number,
    far: number
  ): Intersection[] {
    if (!mesh.visible) {
      return [];
    }

    // Update world matrix
    mesh.updateWorldMatrix(true, false);

    // Transform ray to local space
    const worldMatrixInverse = mesh.worldMatrix.inverse();
    const localRay = this._transformRayToLocal(ray, worldMatrixInverse);

    // Test all triangles
    const intersections: Intersection[] = [];
    const { positions, indices, uvs } = mesh.geometry;

    for (let i = 0; i < indices.length; i += 3) {
      const intersection = this._intersectTriangle(
        localRay,
        ray,
        mesh,
        positions,
        indices,
        uvs,
        i,
        near,
        far
      );

      if (intersection) {
        intersections.push(intersection);
      }
    }

    return intersections;
  }

  private static _transformRayToLocal(ray: Ray, worldMatrixInverse: any): Ray {
    const localRayOrigin = worldMatrixInverse.transformPoint(ray.origin);
    const localRayDirection = worldMatrixInverse
      .transformDirection(ray.direction)
      .normalize();

    return new Ray(localRayOrigin, localRayDirection);
  }

  private static _intersectTriangle(
    localRay: Ray,
    worldRay: Ray,
    mesh: Mesh,
    positions: Float32Array,
    indices: Uint16Array | Uint32Array,
    uvs: Float32Array | undefined,
    startIndex: number,
    near: number,
    far: number
  ): Intersection | null {
    const faceIndex = Math.floor(startIndex / 3);

    const i0 = indices[startIndex];
    const i1 = indices[startIndex + 1];
    const i2 = indices[startIndex + 2];

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

    const rayIntersection = localRay.intersectTriangle(v0, v1, v2);
    if (!rayIntersection) {
      return null;
    }

    const { point, faceNormal } = rayIntersection;

    // Transform to world space
    const worldPoint = mesh.worldMatrix.transformPoint(point);
    const worldNormal = mesh.worldMatrix
      .transformDirection(faceNormal)
      .normalize();

    // Check distance constraints
    const distance = worldRay.origin.sub(worldPoint).length;
    if (distance < near || distance > far) {
      return null;
    }

    // Calculate UV coordinates if available
    let uv: Vector2 | undefined = undefined;
    if (uvs) {
      const barycentric = BarycentricCoordinates.calculate(point, v0, v1, v2);
      if (barycentric) {
        const uv0 = new Vector2(uvs[i0 * 2], uvs[i0 * 2 + 1]);
        const uv1 = new Vector2(uvs[i1 * 2], uvs[i1 * 2 + 1]);
        const uv2 = new Vector2(uvs[i2 * 2], uvs[i2 * 2 + 1]);
        uv = BarycentricCoordinates.interpolateUV(barycentric, uv0, uv1, uv2);
      }
    }

    return {
      distance,
      point: worldPoint,
      object: mesh,
      faceIndex,
      normal: worldNormal,
      uv,
    };
  }
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
    this.ray = CameraRayHelper.createRayFromCamera(coords, camera);
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
    const meshIntersections = IntersectionCalculator.calculateMeshIntersections(
      this.ray,
      mesh,
      this.near,
      this.far
    );

    intersections.push(...meshIntersections);
  }
}
