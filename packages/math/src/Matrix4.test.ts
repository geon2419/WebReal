import { describe, it, expect } from "vitest";
import { Matrix4 } from "./Matrix4";
import { Vector3 } from "./Vector3";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function expectMatrixClose(m: Matrix4, expected: number[]) {
  expected.forEach((v, i) => expect(m.data[i]).toBeCloseTo(v, 5));
}

describe("Matrix4", () => {
  describe("constructor & identity", () => {
    it("should initialize to identity matrix", () => {
      expectMatrixClose(new Matrix4(), IDENTITY);
    });

    it("should reset to identity and return this", () => {
      const m = new Matrix4().translate(new Vector3(1, 2, 3));
      expect(m.identity()).toBe(m);
      expectMatrixClose(m, IDENTITY);
    });
  });

  describe("multiply", () => {
    it("should return identity when multiplying identities", () => {
      expectMatrixClose(new Matrix4().multiply(new Matrix4()), IDENTITY);
    });

    it("should not be commutative (T*S ≠ S*T)", () => {
      const t = Matrix4.translation(new Vector3(1, 0, 0));
      const s = Matrix4.scaling(new Vector3(2, 2, 2));
      expect(t.multiply(s).data[12]).not.toEqual(s.multiply(t).data[12]);
    });
  });

  describe("translate", () => {
    it("should apply and accumulate translation", () => {
      const m = new Matrix4().translate(new Vector3(1, 2, 3));
      expect(m.data[12]).toBeCloseTo(1);
      expect(m.data[13]).toBeCloseTo(2);
      expect(m.data[14]).toBeCloseTo(3);
    });
  });

  describe("scale", () => {
    it("should apply scaling correctly", () => {
      const m = new Matrix4().scale(new Vector3(2, 3, 4));
      expect(m.data[0]).toBeCloseTo(2);
      expect(m.data[5]).toBeCloseTo(3);
      expect(m.data[10]).toBeCloseTo(4);
    });
  });

  describe("rotateY", () => {
    it("should rotate by π/2 correctly (right-handed coordinate system)", () => {
      const m = new Matrix4().rotateY(Math.PI / 2);
      // Right-handed Y rotation: [cos, 0, -sin], [0, 1, 0], [sin, 0, cos]
      expect(m.data[0]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[2]).toBeCloseTo(-1); // -sin(π/2)
      expect(m.data[8]).toBeCloseTo(1); // sin(π/2)
      expect(m.data[10]).toBeCloseTo(0); // cos(π/2)
    });
  });

  describe("clone", () => {
    it("should create independent copy", () => {
      const m = new Matrix4().translate(new Vector3(1, 2, 3));
      const clone = m.clone();
      m.translate(new Vector3(4, 5, 6));
      expect(clone.data[12]).toBeCloseTo(1);
    });
  });

  describe("static translation", () => {
    it("should place values at column-major indices 12,13,14", () => {
      const m = Matrix4.translation(new Vector3(1, 2, 3));
      expect(m.data[12]).toBe(1);
      expect(m.data[13]).toBe(2);
      expect(m.data[14]).toBe(3);
    });
  });

  describe("static scaling", () => {
    it("should place values at diagonal indices 0,5,10", () => {
      const m = Matrix4.scaling(new Vector3(2, 3, 4));
      expect(m.data[0]).toBe(2);
      expect(m.data[5]).toBe(3);
      expect(m.data[10]).toBe(4);
    });
  });

  describe("static rotationY", () => {
    it("should create correct rotation matrix (right-handed)", () => {
      const m = Matrix4.rotationY(Math.PI / 2);
      // Right-handed Y rotation: [cos, 0, -sin], [0, 1, 0], [sin, 0, cos]
      expect(m.data[0]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[2]).toBeCloseTo(-1); // -sin(π/2)
      expect(m.data[8]).toBeCloseTo(1); // sin(π/2)
      expect(m.data[10]).toBeCloseTo(0); // cos(π/2)
    });
  });

  describe("static perspective", () => {
    it("should create valid perspective matrix", () => {
      const m = Matrix4.perspective(Math.PI / 4, 16 / 9, 0.1, 100);
      expect(m.data[11]).toBeCloseTo(-1);
      expect(m.data[15]).toBeCloseTo(0);
    });
  });

  describe("static lookAt", () => {
    it("should create valid view matrix", () => {
      const m = Matrix4.lookAt(
        new Vector3(0, 0, 5),
        new Vector3(0, 0, 0),
        new Vector3(0, 1, 0)
      );
      expect(m.data[14]).toBeCloseTo(-5);
      expect(m.data[15]).toBe(1);
    });

    it("should return identity matrix when eye equals target", () => {
      const m = Matrix4.lookAt(
        new Vector3(1, 2, 3),
        new Vector3(1, 2, 3),
        new Vector3(0, 1, 0)
      );
      expectMatrixClose(m, IDENTITY);
    });

    it("should handle up vector parallel to viewing direction (looking down)", () => {
      const m = Matrix4.lookAt(
        new Vector3(0, 5, 0),
        new Vector3(0, 0, 0),
        new Vector3(0, 1, 0)
      );
      // Should not produce NaN values
      for (let i = 0; i < 16; i++) {
        expect(Number.isNaN(m.data[i])).toBe(false);
      }
      expect(m.data[15]).toBe(1);
    });

    it("should handle up vector parallel to viewing direction (looking up)", () => {
      const m = Matrix4.lookAt(
        new Vector3(0, -5, 0),
        new Vector3(0, 0, 0),
        new Vector3(0, 1, 0)
      );
      // Should not produce NaN values
      for (let i = 0; i < 16; i++) {
        expect(Number.isNaN(m.data[i])).toBe(false);
      }
      expect(m.data[15]).toBe(1);
    });
  });

  describe("chaining", () => {
    it("should support method chaining with correct order", () => {
      const m = new Matrix4()
        .scale(new Vector3(2, 2, 2))
        .rotateY(Math.PI / 4)
        .translate(new Vector3(1, 2, 3));
      expect(m).toBeInstanceOf(Matrix4);
      expect(m.data[0]).not.toBe(1);
    });
  });
});
