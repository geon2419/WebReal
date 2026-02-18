import { describe, it, expect } from "bun:test";
import { BoundingBox } from "./BoundingBox";
import { Vector3 } from "./Vector3";

describe("BoundingBox", () => {
  describe("constructor", () => {
    it("should create an empty box with default parameters", () => {
      const box = new BoundingBox();
      expect(box.min.x).toBe(Infinity);
      expect(box.min.y).toBe(Infinity);
      expect(box.min.z).toBe(Infinity);
      expect(box.max.x).toBe(-Infinity);
      expect(box.max.y).toBe(-Infinity);
      expect(box.max.z).toBe(-Infinity);
      expect(box.isEmpty()).toBe(true);
    });

    it("should create a box with specified min and max", () => {
      const min = new Vector3(-1, -2, -3);
      const max = new Vector3(1, 2, 3);
      const box = new BoundingBox(min, max);
      expect(box.min).toBe(min);
      expect(box.max).toBe(max);
      expect(box.isEmpty()).toBe(false);
    });
  });

  describe("fromPositions", () => {
    it("should return an empty box for empty positions array", () => {
      const positions = new Float32Array([]);
      const box = BoundingBox.fromPositions(positions);
      expect(box.isEmpty()).toBe(true);
    });

    it("should create a box from a single position", () => {
      const positions = new Float32Array([1, 2, 3]);
      const box = BoundingBox.fromPositions(positions);
      expect(box.min.x).toBe(1);
      expect(box.min.y).toBe(2);
      expect(box.min.z).toBe(3);
      expect(box.max.x).toBe(1);
      expect(box.max.y).toBe(2);
      expect(box.max.z).toBe(3);
    });

    it("should create a box from multiple positions", () => {
      const positions = new Float32Array([
        -1,
        -2,
        -3, // min point
        1,
        2,
        3, // max point
        0,
        0,
        0, // center point
      ]);
      const box = BoundingBox.fromPositions(positions);
      expect(box.min.x).toBe(-1);
      expect(box.min.y).toBe(-2);
      expect(box.min.z).toBe(-3);
      expect(box.max.x).toBe(1);
      expect(box.max.y).toBe(2);
      expect(box.max.z).toBe(3);
    });

    it("should handle positions with mixed min/max components", () => {
      const positions = new Float32Array([
        -5,
        0,
        10, // min.x, max.z
        5,
        -10,
        0, // max.x, min.y
        0,
        5,
        -5, // max.y, min.z
      ]);
      const box = BoundingBox.fromPositions(positions);
      expect(box.min.x).toBe(-5);
      expect(box.min.y).toBe(-10);
      expect(box.min.z).toBe(-5);
      expect(box.max.x).toBe(5);
      expect(box.max.y).toBe(5);
      expect(box.max.z).toBe(10);
    });
  });

  describe("containsPoint", () => {
    it("should return true for a point inside the box", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      expect(box.containsPoint(new Vector3(0, 0, 0))).toBe(true);
      expect(box.containsPoint(new Vector3(0.5, 0.5, 0.5))).toBe(true);
    });

    it("should return true for a point on the boundary", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      expect(box.containsPoint(new Vector3(-1, -1, -1))).toBe(true);
      expect(box.containsPoint(new Vector3(1, 1, 1))).toBe(true);
      expect(box.containsPoint(new Vector3(0, 1, 0))).toBe(true);
    });

    it("should return false for a point outside the box", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      expect(box.containsPoint(new Vector3(2, 0, 0))).toBe(false);
      expect(box.containsPoint(new Vector3(0, -2, 0))).toBe(false);
      expect(box.containsPoint(new Vector3(0, 0, 2))).toBe(false);
    });
  });

  describe("intersectsBox", () => {
    it("should return true for overlapping boxes", () => {
      const box1 = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      const box2 = new BoundingBox(new Vector3(0, 0, 0), new Vector3(2, 2, 2));
      expect(box1.intersectsBox(box2)).toBe(true);
      expect(box2.intersectsBox(box1)).toBe(true);
    });

    it("should return true for boxes that touch at edges", () => {
      const box1 = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(0, 0, 0),
      );
      const box2 = new BoundingBox(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
      expect(box1.intersectsBox(box2)).toBe(true);
    });

    it("should return false for non-overlapping boxes", () => {
      const box1 = new BoundingBox(
        new Vector3(-2, -2, -2),
        new Vector3(-1, -1, -1),
      );
      const box2 = new BoundingBox(new Vector3(1, 1, 1), new Vector3(2, 2, 2));
      expect(box1.intersectsBox(box2)).toBe(false);
    });

    it("should return true when one box contains another", () => {
      const box1 = new BoundingBox(
        new Vector3(-2, -2, -2),
        new Vector3(2, 2, 2),
      );
      const box2 = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      expect(box1.intersectsBox(box2)).toBe(true);
      expect(box2.intersectsBox(box1)).toBe(true);
    });
  });

  describe("getCenter", () => {
    it("should return the center point of the box", () => {
      const box = new BoundingBox(
        new Vector3(-2, -4, -6),
        new Vector3(2, 4, 6),
      );
      const center = box.getCenter();
      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
      expect(center.z).toBe(0);
    });

    it("should handle non-centered boxes", () => {
      const box = new BoundingBox(new Vector3(1, 2, 3), new Vector3(5, 8, 11));
      const center = box.getCenter();
      expect(center.x).toBe(3);
      expect(center.y).toBe(5);
      expect(center.z).toBe(7);
    });
  });

  describe("getSize", () => {
    it("should return the dimensions of the box", () => {
      const box = new BoundingBox(
        new Vector3(-1, -2, -3),
        new Vector3(1, 2, 3),
      );
      const size = box.getSize();
      expect(size.x).toBe(2);
      expect(size.y).toBe(4);
      expect(size.z).toBe(6);
    });

    it("should return zero size for a point box", () => {
      const box = new BoundingBox(new Vector3(1, 2, 3), new Vector3(1, 2, 3));
      const size = box.getSize();
      expect(size.x).toBe(0);
      expect(size.y).toBe(0);
      expect(size.z).toBe(0);
    });
  });

  describe("expandByPoint", () => {
    it("should expand the box to include a new point", () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
      box.expandByPoint(new Vector3(2, 2, 2));
      expect(box.max.x).toBe(2);
      expect(box.max.y).toBe(2);
      expect(box.max.z).toBe(2);
    });

    it("should not change the box if point is already inside", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      box.expandByPoint(new Vector3(0, 0, 0));
      expect(box.min.x).toBe(-1);
      expect(box.min.y).toBe(-1);
      expect(box.min.z).toBe(-1);
      expect(box.max.x).toBe(1);
      expect(box.max.y).toBe(1);
      expect(box.max.z).toBe(1);
    });

    it("should expand the box in negative direction", () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
      box.expandByPoint(new Vector3(-2, -2, -2));
      expect(box.min.x).toBe(-2);
      expect(box.min.y).toBe(-2);
      expect(box.min.z).toBe(-2);
    });

    it("should preserve the same min/max Vector3 instances", () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
      const minRef = box.min;
      const maxRef = box.max;
      box.expandByPoint(new Vector3(2, 2, 2));
      expect(box.min).toBe(minRef);
      expect(box.max).toBe(maxRef);
    });

    it("should return this for chaining", () => {
      const box = new BoundingBox();
      const result = box.expandByPoint(new Vector3(1, 1, 1));
      expect(result).toBe(box);
    });
  });

  describe("union", () => {
    it("should return a box that contains both boxes", () => {
      const box1 = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      const box2 = new BoundingBox(new Vector3(0, 0, 0), new Vector3(2, 2, 2));
      const result = box1.union(box2);
      expect(result.min.x).toBe(-1);
      expect(result.min.y).toBe(-1);
      expect(result.min.z).toBe(-1);
      expect(result.max.x).toBe(2);
      expect(result.max.y).toBe(2);
      expect(result.max.z).toBe(2);
    });

    it("should not modify the original boxes", () => {
      const box1 = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      const box2 = new BoundingBox(new Vector3(0, 0, 0), new Vector3(2, 2, 2));
      box1.union(box2);
      expect(box1.max.x).toBe(1);
      expect(box2.min.x).toBe(0);
    });

    it("should handle non-overlapping boxes", () => {
      const box1 = new BoundingBox(
        new Vector3(-2, -2, -2),
        new Vector3(-1, -1, -1),
      );
      const box2 = new BoundingBox(new Vector3(1, 1, 1), new Vector3(2, 2, 2));
      const result = box1.union(box2);
      expect(result.min.x).toBe(-2);
      expect(result.max.x).toBe(2);
    });
  });

  describe("clone", () => {
    it("should create a copy of the box", () => {
      const box = new BoundingBox(
        new Vector3(-1, -2, -3),
        new Vector3(1, 2, 3),
      );
      const clone = box.clone();
      expect(clone.min.x).toBe(box.min.x);
      expect(clone.min.y).toBe(box.min.y);
      expect(clone.min.z).toBe(box.min.z);
      expect(clone.max.x).toBe(box.max.x);
      expect(clone.max.y).toBe(box.max.y);
      expect(clone.max.z).toBe(box.max.z);
    });

    it("should create independent min/max vectors", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      const clone = box.clone();
      expect(clone.min).not.toBe(box.min);
      expect(clone.max).not.toBe(box.max);
    });

    it("should not affect original when modified", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      const clone = box.clone();
      clone.expandByPoint(new Vector3(5, 5, 5));
      expect(box.max.x).toBe(1);
      expect(clone.max.x).toBe(5);
    });
  });

  describe("isEmpty", () => {
    it("should return true for an empty box", () => {
      const box = new BoundingBox();
      expect(box.isEmpty()).toBe(true);
    });

    it("should return false for a valid box", () => {
      const box = new BoundingBox(
        new Vector3(-1, -1, -1),
        new Vector3(1, 1, 1),
      );
      expect(box.isEmpty()).toBe(false);
    });

    it("should return false for a point box (min equals max)", () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
      expect(box.isEmpty()).toBe(false);
    });

    it("should return true if min > max in any dimension", () => {
      const box1 = new BoundingBox(
        new Vector3(1, -1, -1),
        new Vector3(-1, 1, 1),
      );
      expect(box1.isEmpty()).toBe(true);

      const box2 = new BoundingBox(
        new Vector3(-1, 1, -1),
        new Vector3(1, -1, 1),
      );
      expect(box2.isEmpty()).toBe(true);

      const box3 = new BoundingBox(
        new Vector3(-1, -1, 1),
        new Vector3(1, 1, -1),
      );
      expect(box3.isEmpty()).toBe(true);
    });
  });
});
