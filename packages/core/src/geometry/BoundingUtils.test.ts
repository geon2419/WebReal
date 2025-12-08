import { describe, it, expect } from "vitest";
import { computeBoundingBox, computeBoundingSphere } from "./BoundingUtils";
import { BoxGeometry } from "./BoxGeometry";
import { PlaneGeometry } from "./PlaneGeometry";
import { Vector3, BoundingBox, BoundingSphere } from "@web-real/math";

describe("BoundingUtils", () => {
  describe("computeBoundingBox", () => {
    it("should compute bounding box for a simple box geometry", () => {
      const box = new BoxGeometry(2, 2, 2);
      const boundingBox = computeBoundingBox(box);

      expect(boundingBox).toBeInstanceOf(BoundingBox);
      expect(boundingBox.min).toBeInstanceOf(Vector3);
      expect(boundingBox.max).toBeInstanceOf(Vector3);
    });

    it("should compute correct bounds for a centered box", () => {
      const width = 4;
      const height = 6;
      const depth = 8;
      const box = new BoxGeometry(width, height, depth);
      const boundingBox = computeBoundingBox(box);

      // Box is centered at origin, so bounds should be ±half dimensions
      expect(boundingBox.min.x).toBeCloseTo(-width / 2, 5);
      expect(boundingBox.min.y).toBeCloseTo(-height / 2, 5);
      expect(boundingBox.min.z).toBeCloseTo(-depth / 2, 5);
      expect(boundingBox.max.x).toBeCloseTo(width / 2, 5);
      expect(boundingBox.max.y).toBeCloseTo(height / 2, 5);
      expect(boundingBox.max.z).toBeCloseTo(depth / 2, 5);
    });

    it("should compute correct bounds for a plane in XY orientation", () => {
      const width = 10;
      const height = 8;
      const plane = new PlaneGeometry({
        width,
        height,
        orientation: "XY",
      });
      const boundingBox = computeBoundingBox(plane);

      expect(boundingBox.min.x).toBeCloseTo(-width / 2, 5);
      expect(boundingBox.min.y).toBeCloseTo(-height / 2, 5);
      expect(boundingBox.min.z).toBeCloseTo(0, 5);
      expect(boundingBox.max.x).toBeCloseTo(width / 2, 5);
      expect(boundingBox.max.y).toBeCloseTo(height / 2, 5);
      expect(boundingBox.max.z).toBeCloseTo(0, 5);
    });

    it("should compute correct bounds for a plane in XZ orientation", () => {
      const width = 10;
      const height = 8;
      const plane = new PlaneGeometry({
        width,
        height,
        orientation: "XZ",
      });
      const boundingBox = computeBoundingBox(plane);

      expect(boundingBox.min.x).toBeCloseTo(-width / 2, 5);
      expect(boundingBox.min.y).toBeCloseTo(0, 5);
      expect(boundingBox.min.z).toBeCloseTo(-height / 2, 5);
      expect(boundingBox.max.x).toBeCloseTo(width / 2, 5);
      expect(boundingBox.max.y).toBeCloseTo(0, 5);
      expect(boundingBox.max.z).toBeCloseTo(height / 2, 5);
    });

    it("should compute correct bounds for a plane in YZ orientation", () => {
      const width = 10;
      const height = 8;
      const plane = new PlaneGeometry({
        width,
        height,
        orientation: "YZ",
      });
      const boundingBox = computeBoundingBox(plane);

      expect(boundingBox.min.x).toBeCloseTo(0, 5);
      expect(boundingBox.min.y).toBeCloseTo(-width / 2, 5);
      expect(boundingBox.min.z).toBeCloseTo(-height / 2, 5);
      expect(boundingBox.max.x).toBeCloseTo(0, 5);
      expect(boundingBox.max.y).toBeCloseTo(width / 2, 5);
      expect(boundingBox.max.z).toBeCloseTo(height / 2, 5);
    });

    it("should handle geometry with segments", () => {
      const box = new BoxGeometry(2, 2, 2, 5, 5, 5);
      const boundingBox = computeBoundingBox(box);

      // Bounds should be the same regardless of segments
      expect(boundingBox.min.x).toBeCloseTo(-1, 5);
      expect(boundingBox.min.y).toBeCloseTo(-1, 5);
      expect(boundingBox.min.z).toBeCloseTo(-1, 5);
      expect(boundingBox.max.x).toBeCloseTo(1, 5);
      expect(boundingBox.max.y).toBeCloseTo(1, 5);
      expect(boundingBox.max.z).toBeCloseTo(1, 5);
    });

    it("should handle very small geometry", () => {
      const box = new BoxGeometry(0.001, 0.001, 0.001);
      const boundingBox = computeBoundingBox(box);

      expect(boundingBox.min.x).toBeCloseTo(-0.0005, 6);
      expect(boundingBox.max.x).toBeCloseTo(0.0005, 6);
    });

    it("should handle very large geometry", () => {
      const box = new BoxGeometry(1000, 1000, 1000);
      const boundingBox = computeBoundingBox(box);

      expect(boundingBox.min.x).toBeCloseTo(-500, 2);
      expect(boundingBox.max.x).toBeCloseTo(500, 2);
    });

    it("should compute size correctly", () => {
      const width = 8;
      const height = 6;
      const depth = 4;
      const box = new BoxGeometry(width, height, depth);
      const boundingBox = computeBoundingBox(box);

      const size = boundingBox.getSize();
      expect(size.x).toBeCloseTo(width, 5);
      expect(size.y).toBeCloseTo(height, 5);
      expect(size.z).toBeCloseTo(depth, 5);
    });

    it("should compute center correctly", () => {
      const box = new BoxGeometry(4, 6, 8);
      const boundingBox = computeBoundingBox(box);

      const center = boundingBox.getCenter();
      expect(center.x).toBeCloseTo(0, 5);
      expect(center.y).toBeCloseTo(0, 5);
      expect(center.z).toBeCloseTo(0, 5);
    });

    it("should handle non-uniform dimensions", () => {
      const box = new BoxGeometry(1, 10, 0.5);
      const boundingBox = computeBoundingBox(box);

      expect(boundingBox.min.x).toBeCloseTo(-0.5, 5);
      expect(boundingBox.min.y).toBeCloseTo(-5, 5);
      expect(boundingBox.min.z).toBeCloseTo(-0.25, 5);
      expect(boundingBox.max.x).toBeCloseTo(0.5, 5);
      expect(boundingBox.max.y).toBeCloseTo(5, 5);
      expect(boundingBox.max.z).toBeCloseTo(0.25, 5);
    });
  });

  describe("computeBoundingSphere", () => {
    it("should compute bounding sphere for a simple box geometry", () => {
      const box = new BoxGeometry(2, 2, 2);
      const boundingSphere = computeBoundingSphere(box);

      expect(boundingSphere).toBeInstanceOf(BoundingSphere);
      expect(boundingSphere.center).toBeInstanceOf(Vector3);
      expect(typeof boundingSphere.radius).toBe("number");
    });

    it("should compute sphere centered at origin for centered geometry", () => {
      const box = new BoxGeometry(4, 4, 4);
      const boundingSphere = computeBoundingSphere(box);

      expect(boundingSphere.center.x).toBeCloseTo(0, 5);
      expect(boundingSphere.center.y).toBeCloseTo(0, 5);
      expect(boundingSphere.center.z).toBeCloseTo(0, 5);
    });

    it("should have positive radius for valid geometry", () => {
      const box = new BoxGeometry(2, 2, 2);
      const boundingSphere = computeBoundingSphere(box);

      expect(boundingSphere.radius).toBeGreaterThan(0);
    });

    it("should compute correct radius for a cube", () => {
      const size = 2;
      const box = new BoxGeometry(size, size, size);
      const boundingSphere = computeBoundingSphere(box);

      // For a cube centered at origin with side length 2,
      // the radius should be the distance from center to corner
      // = sqrt(3) * (size/2) = sqrt(3)
      const expectedRadius = Math.sqrt(3) * (size / 2);
      expect(boundingSphere.radius).toBeCloseTo(expectedRadius, 5);
    });

    it("should compute correct radius for a rectangular box", () => {
      const width = 4;
      const height = 6;
      const depth = 8;
      const box = new BoxGeometry(width, height, depth);
      const boundingSphere = computeBoundingSphere(box);

      // Radius should be distance from center to farthest corner
      const expectedRadius = Math.sqrt(
        (width / 2) ** 2 + (height / 2) ** 2 + (depth / 2) ** 2
      );
      expect(boundingSphere.radius).toBeCloseTo(expectedRadius, 5);
    });

    it("should compute sphere for plane geometry", () => {
      const width = 10;
      const height = 8;
      const plane = new PlaneGeometry({
        width,
        height,
        orientation: "XY",
      });
      const boundingSphere = computeBoundingSphere(plane);

      // For a plane, radius should be distance from center to corner
      const expectedRadius = Math.sqrt((width / 2) ** 2 + (height / 2) ** 2);
      expect(boundingSphere.radius).toBeCloseTo(expectedRadius, 5);
    });

    it("should handle geometry with many segments", () => {
      const box = new BoxGeometry(2, 2, 2, 10, 10, 10);
      const boundingSphere = computeBoundingSphere(box);

      // Sphere should still encompass the same volume
      const expectedRadius = Math.sqrt(3);
      expect(boundingSphere.radius).toBeCloseTo(expectedRadius, 5);
    });

    it("should contain all vertices of the geometry", () => {
      const box = new BoxGeometry(4, 6, 8);
      const boundingSphere = computeBoundingSphere(box);
      const positions = box.positions;

      // Check that all vertices are within the sphere
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        const distance = Math.sqrt(
          (x - boundingSphere.center.x) ** 2 +
            (y - boundingSphere.center.y) ** 2 +
            (z - boundingSphere.center.z) ** 2
        );

        expect(distance).toBeLessThanOrEqual(boundingSphere.radius + 0.0001);
      }
    });

    it("should handle very small geometry", () => {
      const box = new BoxGeometry(0.001, 0.001, 0.001);
      const boundingSphere = computeBoundingSphere(box);

      expect(boundingSphere.radius).toBeGreaterThan(0);
      expect(boundingSphere.radius).toBeLessThan(0.001);
    });

    it("should handle very large geometry", () => {
      const box = new BoxGeometry(1000, 1000, 1000);
      const boundingSphere = computeBoundingSphere(box);

      const expectedRadius = Math.sqrt(3) * 500;
      expect(boundingSphere.radius).toBeCloseTo(expectedRadius, 1);
    });

    it("should handle non-uniform dimensions", () => {
      const width = 1;
      const height = 10;
      const depth = 0.5;
      const box = new BoxGeometry(width, height, depth);
      const boundingSphere = computeBoundingSphere(box);

      const expectedRadius = Math.sqrt(
        (width / 2) ** 2 + (height / 2) ** 2 + (depth / 2) ** 2
      );
      expect(boundingSphere.radius).toBeCloseTo(expectedRadius, 5);
    });

    it("should have at least one vertex on the sphere surface", () => {
      const box = new BoxGeometry(4, 6, 8);
      const boundingSphere = computeBoundingSphere(box);
      const positions = box.positions;

      // At least one vertex should be at exactly the radius distance
      let hasVertexOnSurface = false;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        const distance = Math.sqrt(
          (x - boundingSphere.center.x) ** 2 +
            (y - boundingSphere.center.y) ** 2 +
            (z - boundingSphere.center.z) ** 2
        );

        if (Math.abs(distance - boundingSphere.radius) < 0.0001) {
          hasVertexOnSurface = true;
          break;
        }
      }

      expect(hasVertexOnSurface).toBe(true);
    });
  });

  describe("bounding box and sphere consistency", () => {
    it("should have sphere center match bounding box center", () => {
      const box = new BoxGeometry(4, 6, 8);
      const boundingBox = computeBoundingBox(box);
      const boundingSphere = computeBoundingSphere(box);

      const boxCenter = boundingBox.getCenter();
      expect(boundingSphere.center.x).toBeCloseTo(boxCenter.x, 5);
      expect(boundingSphere.center.y).toBeCloseTo(boxCenter.y, 5);
      expect(boundingSphere.center.z).toBeCloseTo(boxCenter.z, 5);
    });

    it("should have sphere contain entire bounding box", () => {
      const box = new BoxGeometry(4, 6, 8);
      const boundingBox = computeBoundingBox(box);
      const boundingSphere = computeBoundingSphere(box);

      // All 8 corners of the box should be within the sphere
      const corners = [
        new Vector3(boundingBox.min.x, boundingBox.min.y, boundingBox.min.z),
        new Vector3(boundingBox.min.x, boundingBox.min.y, boundingBox.max.z),
        new Vector3(boundingBox.min.x, boundingBox.max.y, boundingBox.min.z),
        new Vector3(boundingBox.min.x, boundingBox.max.y, boundingBox.max.z),
        new Vector3(boundingBox.max.x, boundingBox.min.y, boundingBox.min.z),
        new Vector3(boundingBox.max.x, boundingBox.min.y, boundingBox.max.z),
        new Vector3(boundingBox.max.x, boundingBox.max.y, boundingBox.min.z),
        new Vector3(boundingBox.max.x, boundingBox.max.y, boundingBox.max.z),
      ];

      for (const corner of corners) {
        const distance = boundingSphere.center.distanceTo(corner);
        expect(distance).toBeLessThanOrEqual(boundingSphere.radius + 0.0001);
      }
    });

    it("should compute consistently for different geometries", () => {
      const geometries = [
        new BoxGeometry(2, 2, 2),
        new BoxGeometry(4, 6, 8),
        new PlaneGeometry({ width: 10, height: 8, orientation: "XY" }),
        new PlaneGeometry({ width: 5, height: 5, orientation: "XZ" }),
      ];

      for (const geometry of geometries) {
        const boundingBox = computeBoundingBox(geometry);
        const boundingSphere = computeBoundingSphere(geometry);

        // Basic sanity checks
        expect(boundingBox.min.x).toBeLessThanOrEqual(boundingBox.max.x);
        expect(boundingBox.min.y).toBeLessThanOrEqual(boundingBox.max.y);
        expect(boundingBox.min.z).toBeLessThanOrEqual(boundingBox.max.z);
        expect(boundingSphere.radius).toBeGreaterThan(0);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle plane with zero thickness in one dimension", () => {
      const plane = new PlaneGeometry({ width: 4, height: 6 });
      const boundingBox = computeBoundingBox(plane);

      // One dimension should be zero (or very close to zero)
      const size = boundingBox.getSize();
      const minDimension = Math.min(size.x, size.y, size.z);
      expect(minDimension).toBeCloseTo(0, 5);
    });

    it("should handle geometry with single segment", () => {
      const box = new BoxGeometry(2, 2, 2, 1, 1, 1);
      const boundingBox = computeBoundingBox(box);
      const boundingSphere = computeBoundingSphere(box);

      expect(boundingBox.min.x).toBeCloseTo(-1, 5);
      expect(boundingBox.max.x).toBeCloseTo(1, 5);
      expect(boundingSphere.radius).toBeCloseTo(Math.sqrt(3), 5);
    });

    it("should handle highly subdivided geometry", () => {
      const box = new BoxGeometry(2, 2, 2, 50, 50, 50);
      const boundingBox = computeBoundingBox(box);
      const boundingSphere = computeBoundingSphere(box);

      // Bounds should be the same regardless of subdivision
      expect(boundingBox.min.x).toBeCloseTo(-1, 5);
      expect(boundingBox.max.x).toBeCloseTo(1, 5);
      expect(boundingSphere.radius).toBeCloseTo(Math.sqrt(3), 5);
    });

    it("should handle extremely non-uniform dimensions", () => {
      const box = new BoxGeometry(0.1, 100, 0.1);
      const boundingBox = computeBoundingBox(box);
      const boundingSphere = computeBoundingSphere(box);

      const size = boundingBox.getSize();
      expect(size.x).toBeCloseTo(0.1, 5);
      expect(size.y).toBeCloseTo(100, 5);
      expect(size.z).toBeCloseTo(0.1, 5);

      // Sphere radius should be dominated by the Y dimension
      expect(boundingSphere.radius).toBeGreaterThan(50);
    });
  });

  describe("real-world usage scenarios", () => {
    it("should compute bounds for a ground plane", () => {
      const ground = new PlaneGeometry({
        width: 100,
        height: 100,
        widthSegments: 10,
        heightSegments: 10,
        orientation: "XZ",
      });

      const boundingBox = computeBoundingBox(ground);
      const boundingSphere = computeBoundingSphere(ground);

      expect(boundingBox.min.y).toBeCloseTo(0, 5);
      expect(boundingBox.max.y).toBeCloseTo(0, 5);
      expect(boundingSphere.center.y).toBeCloseTo(0, 5);
    });

    it("should compute bounds for a wall", () => {
      const wall = new PlaneGeometry({
        width: 10,
        height: 5,
        orientation: "XY",
      });

      const boundingBox = computeBoundingBox(wall);

      expect(boundingBox.min.z).toBeCloseTo(0, 5);
      expect(boundingBox.max.z).toBeCloseTo(0, 5);
    });

    it("should compute bounds for a unit cube", () => {
      const cube = new BoxGeometry(1, 1, 1);
      const boundingBox = computeBoundingBox(cube);
      const boundingSphere = computeBoundingSphere(cube);

      const size = boundingBox.getSize();
      expect(size.x).toBeCloseTo(1, 5);
      expect(size.y).toBeCloseTo(1, 5);
      expect(size.z).toBeCloseTo(1, 5);

      // Unit cube radius = sqrt(3)/2 ≈ 0.866
      expect(boundingSphere.radius).toBeCloseTo(Math.sqrt(3) / 2, 5);
    });

    it("should compute bounds for a billboard quad", () => {
      const billboard = new PlaneGeometry({
        width: 2,
        height: 2,
        widthSegments: 1,
        heightSegments: 1,
        orientation: "XY",
      });

      const boundingBox = computeBoundingBox(billboard);
      const boundingSphere = computeBoundingSphere(billboard);

      // Should be a 2x2 square in XY plane
      const size = boundingBox.getSize();
      expect(size.x).toBeCloseTo(2, 5);
      expect(size.y).toBeCloseTo(2, 5);
      expect(size.z).toBeCloseTo(0, 5);

      // Radius should be sqrt(2) (diagonal half-length)
      expect(boundingSphere.radius).toBeCloseTo(Math.sqrt(2), 5);
    });
  });

  describe("performance considerations", () => {
    it("should handle large number of vertices efficiently", () => {
      const start = performance.now();
      const box = new BoxGeometry(10, 10, 10, 50, 50, 50);
      const boundingBox = computeBoundingBox(box);
      const boundingSphere = computeBoundingSphere(box);
      const end = performance.now();

      // Should complete in reasonable time (< 100ms for large geometry)
      expect(end - start).toBeLessThan(100);
      expect(boundingBox.min.x).toBeCloseTo(-5, 5);
      expect(boundingSphere.radius).toBeCloseTo(Math.sqrt(75), 5);
    });

    it("should compute bounds for multiple geometries", () => {
      const geometries = Array.from(
        { length: 10 },
        () =>
          new BoxGeometry(
            Math.random() * 10,
            Math.random() * 10,
            Math.random() * 10
          )
      );

      const start = performance.now();
      for (const geometry of geometries) {
        computeBoundingBox(geometry);
        computeBoundingSphere(geometry);
      }
      const end = performance.now();

      // Should handle multiple computations efficiently
      expect(end - start).toBeLessThan(50);
    });
  });
});
