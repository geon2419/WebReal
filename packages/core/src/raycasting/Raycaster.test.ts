import { describe, it, expect } from "bun:test";
import { Raycaster } from "./Raycaster";
import { Vector2, Vector3 } from "@web-real/math";
import { PerspectiveCamera } from "../camera/PerspectiveCamera";
import { OrthographicCamera } from "../camera/OrthographicCamera";
import { Mesh } from "../scene/Mesh";
import { Object3D } from "../scene/Object3D";
import { BoxGeometry } from "../geometry/BoxGeometry";
import { VertexColorMaterial } from "../material/VertexColorMaterial";

describe("Raycaster", () => {
  describe("constructor", () => {
    it("should create raycaster with defaults", () => {
      const raycaster = new Raycaster();

      expect(raycaster.ray).toBeDefined();
      expect(raycaster.ray.origin.x).toBe(0);
      expect(raycaster.ray.origin.y).toBe(0);
      expect(raycaster.ray.origin.z).toBe(0);
      expect(raycaster.near).toBe(0);
      expect(raycaster.far).toBe(Infinity);
    });

    it("should allow specifying origin/direction and near/far", () => {
      const origin = new Vector3(1, 2, 3);
      const direction = new Vector3(0, 1, 0);
      const raycaster = new Raycaster(origin, direction, 0.1, 1000);

      expect(raycaster.ray.origin.x).toBe(1);
      expect(raycaster.ray.origin.y).toBe(2);
      expect(raycaster.ray.origin.z).toBe(3);
      expect(raycaster.ray.direction.x).toBe(0);
      expect(raycaster.ray.direction.y).toBe(1);
      expect(raycaster.ray.direction.z).toBe(0);
      expect(raycaster.near).toBe(0.1);
      expect(raycaster.far).toBe(1000);
    });
  });

  describe("setFromCamera", () => {
    it("should create a ray from a perspective camera", () => {
      const camera = new PerspectiveCamera({
        fov: 60,
        aspect: 1,
        near: 0.1,
        far: 100,
      });
      camera.position = new Vector3(0, 0, 5);
      camera.lookAt(new Vector3(0, 0, 0));

      const raycaster = new Raycaster();
      const coords = new Vector2(0, 0); // Center of screen

      const result = raycaster.setFromCamera(coords, camera);
      expect(result).toBe(raycaster);

      // Ray should originate from camera position
      expect(raycaster.ray.origin.x).toBeCloseTo(0, 5);
      expect(raycaster.ray.origin.y).toBeCloseTo(0, 5);
      expect(raycaster.ray.origin.z).toBeCloseTo(5, 5);

      // Direction should be normalized and generally point towards -Z
      const dirLength = Math.sqrt(
        raycaster.ray.direction.x ** 2 +
          raycaster.ray.direction.y ** 2 +
          raycaster.ray.direction.z ** 2,
      );
      expect(dirLength).toBeCloseTo(1, 5);
      expect(raycaster.ray.direction.z).toBeLessThan(0);
    });

    it("should create a ray from an orthographic camera", () => {
      const camera = new OrthographicCamera({
        left: -5,
        right: 5,
        top: 5,
        bottom: -5,
        near: 0.1,
        far: 100,
      });
      camera.position = new Vector3(0, 0, 10);
      camera.lookAt(new Vector3(0, 0, 0));

      const raycaster = new Raycaster();
      const coords = new Vector2(0, 0); // Center of screen

      raycaster.setFromCamera(coords, camera);

      // Direction should be normalized (unit vector)
      const dirLength = Math.sqrt(
        raycaster.ray.direction.x ** 2 +
          raycaster.ray.direction.y ** 2 +
          raycaster.ray.direction.z ** 2,
      );
      expect(dirLength).toBeCloseTo(1, 5);

      // For this setup, ray should generally point towards -Z
      expect(raycaster.ray.direction.z).toBeLessThan(0);
    });
  });

  describe("intersectObject", () => {
    it("should find intersection with mesh in front of ray", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new VertexColorMaterial();
      const mesh = new Mesh(geometry, material);
      mesh.position = new Vector3(0, 0, 0);

      const raycaster = new Raycaster(
        new Vector3(0, 0, 5),
        new Vector3(0, 0, -1),
      );

      const intersections = raycaster.intersectObject(mesh);

      expect(intersections.length).toBeGreaterThan(0);
      expect(intersections[0].object).toBe(mesh);
      expect(intersections[0].distance).toBeGreaterThan(0);
      expect(intersections[0].point).toBeDefined();
      expect(intersections[0].normal).toBeDefined();
      expect(intersections[0].faceIndex).toBeGreaterThanOrEqual(0);

      // Normal should be normalized
      const normalLength = Math.sqrt(
        intersections[0].normal.x ** 2 +
          intersections[0].normal.y ** 2 +
          intersections[0].normal.z ** 2,
      );
      expect(normalLength).toBeCloseTo(1, 5);
    });

    it("should return empty array when ray misses mesh", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new VertexColorMaterial();
      const mesh = new Mesh(geometry, material);
      mesh.position = new Vector3(0, 0, 0);

      const raycaster = new Raycaster(
        new Vector3(10, 10, 5),
        new Vector3(0, 0, -1),
      );

      const intersections = raycaster.intersectObject(mesh);

      expect(intersections.length).toBe(0);
    });

    it("should return empty array when mesh is invisible", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new VertexColorMaterial();
      const mesh = new Mesh(geometry, material);
      mesh.position = new Vector3(0, 0, 0);
      mesh.visible = false;

      const raycaster = new Raycaster(
        new Vector3(0, 0, 5),
        new Vector3(0, 0, -1),
      );

      const intersections = raycaster.intersectObject(mesh);

      expect(intersections.length).toBe(0);
    });

    it("should respect near and far clipping planes", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new VertexColorMaterial();
      const mesh = new Mesh(geometry, material);
      mesh.position = new Vector3(0, 0, 0);

      // Set far plane too close to reach the mesh
      const raycaster = new Raycaster(
        new Vector3(0, 0, 5),
        new Vector3(0, 0, -1),
        0,
        2,
      );

      const intersections = raycaster.intersectObject(mesh);

      expect(intersections.length).toBe(0);
    });

    it("should test children when recursive is true", () => {
      const geometry = new BoxGeometry(1, 1, 1);
      const material = new VertexColorMaterial();

      const parent = new Object3D();

      const child = new Mesh(geometry, material);
      child.position = new Vector3(3, 0, 0);
      parent.add(child);

      const raycaster = new Raycaster(
        new Vector3(3, 0, 5),
        new Vector3(0, 0, -1),
      );

      const intersections = raycaster.intersectObject(parent, true);

      expect(intersections.length).toBeGreaterThan(0);
      expect(intersections[0].object).toBe(child);
    });

    it("should include UV coordinates when geometry has UVs", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new VertexColorMaterial();
      const mesh = new Mesh(geometry, material);
      mesh.position = new Vector3(0, 0, 0);

      const raycaster = new Raycaster(
        new Vector3(0, 0, 5),
        new Vector3(0, 0, -1),
      );

      const intersections = raycaster.intersectObject(mesh);

      expect(intersections.length).toBeGreaterThan(0);
      expect(intersections[0].uv).toBeDefined();
      expect(intersections[0].uv!.x).toBeGreaterThanOrEqual(0);
      expect(intersections[0].uv!.x).toBeLessThanOrEqual(1);
      expect(intersections[0].uv!.y).toBeGreaterThanOrEqual(0);
      expect(intersections[0].uv!.y).toBeLessThanOrEqual(1);
    });
  });

  describe("intersectObjects", () => {
    it("should find and sort intersections across multiple meshes", () => {
      const geometry = new BoxGeometry(1, 1, 1);
      const material = new VertexColorMaterial();

      const mesh1 = new Mesh(geometry, material);
      mesh1.position = new Vector3(0, 0, 0); // Closest

      const mesh2 = new Mesh(geometry, material);
      mesh2.position = new Vector3(0, 0, -5); // Further

      const raycaster = new Raycaster(
        new Vector3(0, 0, 10),
        new Vector3(0, 0, -1),
      );

      const intersections = raycaster.intersectObjects([mesh1, mesh2]);

      expect(intersections.length).toBeGreaterThan(0);
      const objects = intersections.map((i) => i.object);
      expect(objects).toContain(mesh1);
      expect(objects).toContain(mesh2);

      for (let i = 0; i < intersections.length - 1; i++) {
        expect(intersections[i].distance).toBeLessThanOrEqual(
          intersections[i + 1].distance,
        );
      }
    });
  });
});
