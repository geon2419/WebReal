import { describe, it, expect } from "bun:test";
import { BoundingSphere } from "./BoundingSphere";
import { BoundingBox } from "./BoundingBox";
import { Vector3 } from "./Vector3";

describe("BoundingSphere", () => {
  describe("constructor", () => {
    it("should create an empty sphere with default parameters", () => {
      const sphere = new BoundingSphere();
      expect(sphere.center.x).toBe(0);
      expect(sphere.center.y).toBe(0);
      expect(sphere.center.z).toBe(0);
      expect(sphere.radius).toBe(-1);
      expect(sphere.isEmpty()).toBe(true);
    });

    it("should create a sphere with specified center and radius", () => {
      const center = new Vector3(1, 2, 3);
      const radius = 5;
      const sphere = new BoundingSphere(center, radius);
      expect(sphere.center).toBe(center);
      expect(sphere.radius).toBe(radius);
      expect(sphere.isEmpty()).toBe(false);
    });

    it("should treat zero radius as valid (degenerate sphere)", () => {
      const sphere = new BoundingSphere(new Vector3(), 0);
      expect(sphere.isEmpty()).toBe(false);
      expect(sphere.radius).toBe(0);
    });
  });

  describe("fromPositions", () => {
    it("should return an empty sphere for empty positions array", () => {
      const positions = new Float32Array([]);
      const sphere = BoundingSphere.fromPositions(positions);
      expect(sphere.isEmpty()).toBe(true);
      expect(sphere.radius).toBe(-1);
    });

    it("should create a sphere from a single position", () => {
      const positions = new Float32Array([1, 2, 3]);
      const sphere = BoundingSphere.fromPositions(positions);
      expect(sphere.center.x).toBe(1);
      expect(sphere.center.y).toBe(2);
      expect(sphere.center.z).toBe(3);
      expect(sphere.radius).toBe(0);
    });

    it("should create a sphere from two opposite points", () => {
      const positions = new Float32Array([
        -1,
        0,
        0, // left
        1,
        0,
        0, // right
      ]);
      const sphere = BoundingSphere.fromPositions(positions);
      expect(sphere.center.x).toBeCloseTo(0);
      expect(sphere.center.y).toBeCloseTo(0);
      expect(sphere.center.z).toBeCloseTo(0);
      expect(sphere.radius).toBeCloseTo(1);
    });

    it("should create a sphere from multiple positions", () => {
      const positions = new Float32Array([
        -1,
        -1,
        -1, // corner of cube
        1,
        1,
        1, // opposite corner
        0,
        0,
        0, // center
      ]);
      const sphere = BoundingSphere.fromPositions(positions);
      expect(sphere.center.x).toBeCloseTo(0);
      expect(sphere.center.y).toBeCloseTo(0);
      expect(sphere.center.z).toBeCloseTo(0);
      // Radius should be sqrt(3) ≈ 1.732
      expect(sphere.radius).toBeCloseTo(Math.sqrt(3));
    });

    it("should contain all input positions", () => {
      const positions = new Float32Array([
        0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, -1, 0, 0, 0, -1, 0, 0, 0, -1,
      ]);
      const sphere = BoundingSphere.fromPositions(positions);

      // Check that all positions are inside the sphere
      for (let i = 0; i < positions.length; i += 3) {
        const point = new Vector3(
          positions[i],
          positions[i + 1],
          positions[i + 2],
        );
        expect(sphere.containsPoint(point)).toBe(true);
      }
    });
  });

  describe("fromBoundingBox", () => {
    it("should create a sphere from a unit cube", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      const sphere = BoundingSphere.fromBoundingBox(box);
      expect(sphere.center.x).toBeCloseTo(0);
      expect(sphere.center.y).toBeCloseTo(0);
      expect(sphere.center.z).toBeCloseTo(0);
      // Diagonal of cube with side 2 is sqrt(12) = 2*sqrt(3)
      // Radius should be half of diagonal: sqrt(3)
      expect(sphere.radius).toBeCloseTo(Math.sqrt(3));
    });

    it("should create a sphere from an asymmetric box", () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(2, 4, 6));
      const sphere = BoundingSphere.fromBoundingBox(box);
      expect(sphere.center.x).toBeCloseTo(1);
      expect(sphere.center.y).toBeCloseTo(2);
      expect(sphere.center.z).toBeCloseTo(3);
      // Size is (2,4,6), diagonal length is sqrt(4+16+36) = sqrt(56)
      // Radius is half: sqrt(56)/2 = sqrt(14)
      expect(sphere.radius).toBeCloseTo(Math.sqrt(14));
    });

    it("should contain all corners of the bounding box", () => {
      const box = new BoundingBox(
        new Vector3(-2, -3, -4),
        new Vector3(5, 6, 7),
      );
      const sphere = BoundingSphere.fromBoundingBox(box);

      const corners = [
        new Vector3(-2, -3, -4),
        new Vector3(5, -3, -4),
        new Vector3(-2, 6, -4),
        new Vector3(5, 6, -4),
        new Vector3(-2, -3, 7),
        new Vector3(5, -3, 7),
        new Vector3(-2, 6, 7),
        new Vector3(5, 6, 7),
      ];

      corners.forEach((corner) => {
        expect(sphere.containsPoint(corner)).toBe(true);
      });
    });
  });

  describe("containsPoint", () => {
    it("should return true for a point at the center", () => {
      const sphere = new BoundingSphere(new Vector3(0, 0, 0), 1);
      expect(sphere.containsPoint(new Vector3(0, 0, 0))).toBe(true);
    });

    it("should return true for a point inside the sphere", () => {
      const sphere = new BoundingSphere(new Vector3(0, 0, 0), 2);
      expect(sphere.containsPoint(new Vector3(0.5, 0.5, 0.5))).toBe(true);
      expect(sphere.containsPoint(new Vector3(1, 0, 0))).toBe(true);
    });

    it("should return true for a point on the boundary", () => {
      const sphere = new BoundingSphere(new Vector3(0, 0, 0), 1);
      expect(sphere.containsPoint(new Vector3(1, 0, 0))).toBe(true);
      expect(sphere.containsPoint(new Vector3(0, 1, 0))).toBe(true);
      expect(sphere.containsPoint(new Vector3(0, 0, 1))).toBe(true);
    });

    it("should return false for a point outside the sphere", () => {
      const sphere = new BoundingSphere(new Vector3(0, 0, 0), 1);
      expect(sphere.containsPoint(new Vector3(2, 0, 0))).toBe(false);
      expect(sphere.containsPoint(new Vector3(1, 1, 0))).toBe(false);
      expect(sphere.containsPoint(new Vector3(1, 1, 1))).toBe(false);
    });

    it("should work with offset center", () => {
      const sphere = new BoundingSphere(new Vector3(5, 5, 5), 2);
      expect(sphere.containsPoint(new Vector3(5, 5, 5))).toBe(true);
      expect(sphere.containsPoint(new Vector3(6, 5, 5))).toBe(true);
      expect(sphere.containsPoint(new Vector3(7, 5, 5))).toBe(true);
      expect(sphere.containsPoint(new Vector3(8, 5, 5))).toBe(false);
    });
  });

  describe("intersectsSphere", () => {
    it("should return true for overlapping spheres", () => {
      const sphere1 = new BoundingSphere(new Vector3(0, 0, 0), 1);
      const sphere2 = new BoundingSphere(new Vector3(1, 0, 0), 1);
      expect(sphere1.intersectsSphere(sphere2)).toBe(true);
      expect(sphere2.intersectsSphere(sphere1)).toBe(true);
    });

    it("should return true for touching spheres", () => {
      const sphere1 = new BoundingSphere(new Vector3(0, 0, 0), 1);
      const sphere2 = new BoundingSphere(new Vector3(2, 0, 0), 1);
      expect(sphere1.intersectsSphere(sphere2)).toBe(true);
    });

    it("should return false for separated spheres", () => {
      const sphere1 = new BoundingSphere(new Vector3(0, 0, 0), 1);
      const sphere2 = new BoundingSphere(new Vector3(3, 0, 0), 1);
      expect(sphere1.intersectsSphere(sphere2)).toBe(false);
    });

    it("should return true when one sphere contains another", () => {
      const sphere1 = new BoundingSphere(new Vector3(0, 0, 0), 5);
      const sphere2 = new BoundingSphere(new Vector3(1, 0, 0), 1);
      expect(sphere1.intersectsSphere(sphere2)).toBe(true);
      expect(sphere2.intersectsSphere(sphere1)).toBe(true);
    });

    it("should work with spheres at different positions", () => {
      const sphere1 = new BoundingSphere(new Vector3(10, 10, 10), 2);
      const sphere2 = new BoundingSphere(new Vector3(13, 10, 10), 2);
      expect(sphere1.intersectsSphere(sphere2)).toBe(true);

      const sphere3 = new BoundingSphere(new Vector3(15, 10, 10), 2);
      expect(sphere1.intersectsSphere(sphere3)).toBe(false);
    });
  });

  describe("clone", () => {
    it("should create a deep copy of the sphere", () => {
      const original = new BoundingSphere(new Vector3(1, 2, 3), 5);
      const cloned = original.clone();

      expect(cloned.center.x).toBe(original.center.x);
      expect(cloned.center.y).toBe(original.center.y);
      expect(cloned.center.z).toBe(original.center.z);
      expect(cloned.radius).toBe(original.radius);

      // Ensure it's a deep copy
      expect(cloned).not.toBe(original);
      expect(cloned.center).not.toBe(original.center);
    });

    it("should clone independently", () => {
      const original = new BoundingSphere(new Vector3(1, 2, 3), 5);
      const cloned = original.clone();

      cloned.center.x = 10;
      cloned.radius = 20;

      expect(original.center.x).toBe(1);
      expect(original.radius).toBe(5);
    });
  });

  describe("isEmpty", () => {
    it("should return true for negative radius", () => {
      const sphere = new BoundingSphere(new Vector3(), -1);
      expect(sphere.isEmpty()).toBe(true);
    });

    it("should return true for very negative radius", () => {
      const sphere = new BoundingSphere(new Vector3(), -100);
      expect(sphere.isEmpty()).toBe(true);
    });

    it("should return false for zero radius", () => {
      const sphere = new BoundingSphere(new Vector3(), 0);
      expect(sphere.isEmpty()).toBe(false);
    });

    it("should return false for positive radius", () => {
      const sphere = new BoundingSphere(new Vector3(), 1);
      expect(sphere.isEmpty()).toBe(false);
    });

    it("should return true for default constructed sphere", () => {
      const sphere = new BoundingSphere();
      expect(sphere.isEmpty()).toBe(true);
    });
  });
});
