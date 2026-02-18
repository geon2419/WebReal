import { describe, it, expect } from "bun:test";
import { Ray } from "./Ray";
import { Vector3, BoundingBox, BoundingSphere } from "@web-real/math";

describe("Ray", () => {
  describe("constructor", () => {
    it("should create a ray with default origin and direction", () => {
      const ray = new Ray();

      expect(ray.origin.x).toBe(0);
      expect(ray.origin.y).toBe(0);
      expect(ray.origin.z).toBe(0);
      expect(ray.direction.x).toBe(0);
      expect(ray.direction.y).toBe(0);
      expect(ray.direction.z).toBe(-1);
    });

    it("should create a ray with specified origin and direction", () => {
      const origin = new Vector3(1, 2, 3);
      const direction = new Vector3(0, 1, 0);
      const ray = new Ray(origin, direction);

      expect(ray.origin.x).toBe(1);
      expect(ray.origin.y).toBe(2);
      expect(ray.origin.z).toBe(3);
      expect(ray.direction.x).toBe(0);
      expect(ray.direction.y).toBe(1);
      expect(ray.direction.z).toBe(0);
    });
  });

  describe("at", () => {
    it("should return origin + direction * t", () => {
      const ray = new Ray(new Vector3(0, 0, 0), new Vector3(2, 0, 0));
      const point = ray.at(1);

      expect(point.x).toBe(2);
      expect(point.y).toBe(0);
      expect(point.z).toBe(0);
    });
  });

  describe("intersectTriangle", () => {
    it("should return intersection when ray hits triangle front face", () => {
      const ray = new Ray(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
      const v0 = new Vector3(-1, -1, 0);
      const v1 = new Vector3(1, -1, 0);
      const v2 = new Vector3(0, 1, 0);

      const result = ray.intersectTriangle(v0, v1, v2);

      expect(result).not.toBeNull();
      expect(result!.distance).toBeCloseTo(5, 5);
      expect(result!.point.x).toBeCloseTo(0, 5);
      expect(result!.point.y).toBeCloseTo(0, 5);
      expect(result!.point.z).toBeCloseTo(0, 5);
      expect(result!.faceNormal.x).toBeCloseTo(0, 5);
      expect(result!.faceNormal.y).toBeCloseTo(0, 5);
      expect(result!.faceNormal.z).toBeCloseTo(1, 5);
    });

    it("should return null when ray misses triangle", () => {
      const ray = new Ray(new Vector3(10, 10, 5), new Vector3(0, 0, -1));
      const v0 = new Vector3(-1, -1, 0);
      const v1 = new Vector3(1, -1, 0);
      const v2 = new Vector3(0, 1, 0);

      const result = ray.intersectTriangle(v0, v1, v2);

      expect(result).toBeNull();
    });

    it("should return null when ray is parallel to triangle", () => {
      const ray = new Ray(new Vector3(0, 0, 1), new Vector3(1, 0, 0));
      const v0 = new Vector3(-1, -1, 0);
      const v1 = new Vector3(1, -1, 0);
      const v2 = new Vector3(0, 1, 0);

      const result = ray.intersectTriangle(v0, v1, v2);

      expect(result).toBeNull();
    });

    it("should return null when intersection is behind ray origin", () => {
      const ray = new Ray(new Vector3(0, 0, -5), new Vector3(0, 0, -1));
      const v0 = new Vector3(-1, -1, 0);
      const v1 = new Vector3(1, -1, 0);
      const v2 = new Vector3(0, 1, 0);

      const result = ray.intersectTriangle(v0, v1, v2);

      expect(result).toBeNull();
    });

    it("should handle ray hitting triangle edge", () => {
      const ray = new Ray(new Vector3(0, -1, 5), new Vector3(0, 0, -1));
      const v0 = new Vector3(-1, -1, 0);
      const v1 = new Vector3(1, -1, 0);
      const v2 = new Vector3(0, 1, 0);

      const result = ray.intersectTriangle(v0, v1, v2);

      expect(result).not.toBeNull();
      expect(result!.point.x).toBeCloseTo(0, 5);
      expect(result!.point.y).toBeCloseTo(-1, 5);
      expect(result!.point.z).toBeCloseTo(0, 5);
    });
  });

  describe("intersectBox", () => {
    it("should return distance when ray hits box from outside", () => {
      const ray = new Ray(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );

      const distance = ray.intersectBox(box);

      expect(distance).not.toBeNull();
      expect(distance!).toBeCloseTo(4, 5);
    });

    it("should return null when ray misses box", () => {
      const ray = new Ray(new Vector3(5, 5, 5), new Vector3(0, 0, -1));
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );

      const distance = ray.intersectBox(box);

      expect(distance).toBeNull();
    });

    it("should handle ray starting inside box", () => {
      const ray = new Ray(new Vector3(0, 0, 0), new Vector3(1, 0, 0));
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );

      const distance = ray.intersectBox(box);

      expect(distance).not.toBeNull();
      expect(distance!).toBeCloseTo(1, 5); // Distance to exit
    });

    it("should return null for empty bounding box", () => {
      const ray = new Ray(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
      const box = new BoundingBox();

      const distance = ray.intersectBox(box);

      expect(distance).toBeNull();
    });

    it("should handle ray parallel to box face (outside)", () => {
      const ray = new Ray(new Vector3(0, 0, 2), new Vector3(1, 0, 0));
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );

      const distance = ray.intersectBox(box);

      expect(distance).toBeNull();
    });
  });

  describe("intersectSphere", () => {
    it("should return distance when ray hits sphere from outside", () => {
      const ray = new Ray(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
      const sphere = new BoundingSphere(new Vector3(0, 0, 0), 2);

      const distance = ray.intersectSphere(sphere);

      expect(distance).not.toBeNull();
      expect(distance!).toBeCloseTo(3, 5); // 5 - 2 = 3
    });

    it("should return null when ray misses sphere", () => {
      const ray = new Ray(new Vector3(5, 5, 5), new Vector3(0, 0, -1));
      const sphere = new BoundingSphere(new Vector3(0, 0, 0), 1);

      const distance = ray.intersectSphere(sphere);

      expect(distance).toBeNull();
    });

    it("should handle ray starting inside sphere", () => {
      const ray = new Ray(new Vector3(0, 0, 0), new Vector3(1, 0, 0));
      const sphere = new BoundingSphere(new Vector3(0, 0, 0), 2);

      const distance = ray.intersectSphere(sphere);

      expect(distance).not.toBeNull();
      expect(distance!).toBeCloseTo(2, 5); // Distance to exit point
    });

    it("should return null for empty bounding sphere", () => {
      const ray = new Ray(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
      const sphere = new BoundingSphere();

      const distance = ray.intersectSphere(sphere);

      expect(distance).toBeNull();
    });
  });

  describe("clone", () => {
    it("should create a deep copy", () => {
      const ray = new Ray(new Vector3(1, 2, 3), new Vector3(4, 5, 6));
      const clone = ray.clone();

      expect(clone).not.toBe(ray);
      expect(clone.origin).not.toBe(ray.origin);
      expect(clone.direction).not.toBe(ray.direction);

      expect(clone.origin.x).toBe(1);
      expect(clone.origin.y).toBe(2);
      expect(clone.origin.z).toBe(3);
      expect(clone.direction.x).toBe(4);
      expect(clone.direction.y).toBe(5);
      expect(clone.direction.z).toBe(6);

      clone.origin = new Vector3(10, 20, 30);
      clone.direction = new Vector3(40, 50, 60);

      expect(ray.origin.x).toBe(1);
      expect(ray.direction.x).toBe(4);
    });
  });

  describe("set", () => {
    it("should update origin/direction and return this", () => {
      const ray = new Ray();
      const newOrigin = new Vector3(1, 2, 3);
      const newDirection = new Vector3(4, 5, 6);

      const result = ray.set(newOrigin, newDirection);

      expect(result).toBe(ray);

      expect(ray.origin.x).toBe(1);
      expect(ray.origin.y).toBe(2);
      expect(ray.origin.z).toBe(3);
      expect(ray.direction.x).toBe(4);
      expect(ray.direction.y).toBe(5);
      expect(ray.direction.z).toBe(6);
    });
  });
});
