import { describe, it, expect } from "bun:test";
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

  describe("rotateX", () => {
    it("should rotate by π/2 correctly (right-handed coordinate system)", () => {
      const m = new Matrix4().rotateX(Math.PI / 2);
      // Right-handed X rotation: [1, 0, 0], [0, cos, sin], [0, -sin, cos]
      expect(m.data[0]).toBeCloseTo(1);
      expect(m.data[5]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[6]).toBeCloseTo(1); // sin(π/2)
      expect(m.data[9]).toBeCloseTo(-1); // -sin(π/2)
      expect(m.data[10]).toBeCloseTo(0); // cos(π/2)
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

  describe("rotateZ", () => {
    it("should rotate by π/2 correctly (right-handed coordinate system)", () => {
      const m = new Matrix4().rotateZ(Math.PI / 2);
      // Right-handed Z rotation: [cos, sin, 0], [-sin, cos, 0], [0, 0, 1]
      expect(m.data[0]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[1]).toBeCloseTo(1); // sin(π/2)
      expect(m.data[4]).toBeCloseTo(-1); // -sin(π/2)
      expect(m.data[5]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[10]).toBeCloseTo(1);
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

  describe("static rotationX", () => {
    it("should create correct rotation matrix (right-handed)", () => {
      const m = Matrix4.rotationX(Math.PI / 2);
      // Right-handed X rotation: [1, 0, 0], [0, cos, sin], [0, -sin, cos]
      expect(m.data[0]).toBeCloseTo(1);
      expect(m.data[5]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[6]).toBeCloseTo(1); // sin(π/2)
      expect(m.data[9]).toBeCloseTo(-1); // -sin(π/2)
      expect(m.data[10]).toBeCloseTo(0); // cos(π/2)
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

  describe("static rotationZ", () => {
    it("should create correct rotation matrix (right-handed)", () => {
      const m = Matrix4.rotationZ(Math.PI / 2);
      // Right-handed Z rotation: [cos, sin, 0], [-sin, cos, 0], [0, 0, 1]
      expect(m.data[0]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[1]).toBeCloseTo(1); // sin(π/2)
      expect(m.data[4]).toBeCloseTo(-1); // -sin(π/2)
      expect(m.data[5]).toBeCloseTo(0); // cos(π/2)
      expect(m.data[10]).toBeCloseTo(1);
    });
  });

  describe("static orthographic", () => {
    it("should create valid orthographic matrix", () => {
      const m = Matrix4.orthographic(-10, 10, -10, 10, 0.1, 100);
      // Check scale factors
      expect(m.data[0]).toBeCloseTo(2 / 20); // 2/(right-left)
      expect(m.data[5]).toBeCloseTo(2 / 20); // 2/(top-bottom)
      expect(m.data[10]).toBeCloseTo(1 / (0.1 - 100)); // 1/(near-far)
      // Check translation
      expect(m.data[12]).toBeCloseTo(0); // -(right+left)/(right-left)
      expect(m.data[13]).toBeCloseTo(0); // -(top+bottom)/(top-bottom)
      expect(m.data[14]).toBeCloseTo(0.1 / (0.1 - 100)); // near/(near-far)
      expect(m.data[15]).toBeCloseTo(1);
    });

    it("should handle asymmetric frustum", () => {
      const m = Matrix4.orthographic(-5, 15, -8, 12, 1, 50);
      expect(m.data[0]).toBeCloseTo(2 / 20);
      expect(m.data[5]).toBeCloseTo(2 / 20);
      expect(m.data[12]).toBeCloseTo(-10 / 20); // -(15-5)/(15+5)
      expect(m.data[13]).toBeCloseTo(-4 / 20); // -(12-8)/(12+8)
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
        new Vector3(0, 1, 0),
      );
      expect(m.data[14]).toBeCloseTo(-5);
      expect(m.data[15]).toBe(1);
    });

    it("should return identity matrix when eye equals target", () => {
      const m = Matrix4.lookAt(
        new Vector3(1, 2, 3),
        new Vector3(1, 2, 3),
        new Vector3(0, 1, 0),
      );
      expectMatrixClose(m, IDENTITY);
    });

    it("should handle up vector parallel to viewing direction (looking down)", () => {
      const m = Matrix4.lookAt(
        new Vector3(0, 5, 0),
        new Vector3(0, 0, 0),
        new Vector3(0, 1, 0),
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
        new Vector3(0, 1, 0),
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

  describe("inverse", () => {
    it("should return identity for identity matrix", () => {
      const m = new Matrix4();
      const inv = m.inverse();
      expectMatrixClose(inv, IDENTITY);
    });

    it("should return identity for singular matrix (zero determinant)", () => {
      const m = new Matrix4();
      // Make a singular matrix (all zeros in a row)
      m.data.fill(0);
      const inv = m.inverse();
      expectMatrixClose(inv, IDENTITY);
    });

    it("should correctly invert translation matrix", () => {
      const t = Matrix4.translation(new Vector3(3, 5, 7));
      const inv = t.inverse();
      // Inverse translation should have negated values
      expect(inv.data[12]).toBeCloseTo(-3);
      expect(inv.data[13]).toBeCloseTo(-5);
      expect(inv.data[14]).toBeCloseTo(-7);
    });

    it("should correctly invert scaling matrix", () => {
      const s = Matrix4.scaling(new Vector3(2, 4, 8));
      const inv = s.inverse();
      expect(inv.data[0]).toBeCloseTo(0.5);
      expect(inv.data[5]).toBeCloseTo(0.25);
      expect(inv.data[10]).toBeCloseTo(0.125);
    });

    it("should satisfy M * M^-1 = I", () => {
      const m = new Matrix4()
        .translate(new Vector3(1, 2, 3))
        .scale(new Vector3(2, 2, 2))
        .rotateY(Math.PI / 4);
      const inv = m.inverse();
      const result = m.multiply(inv);
      expectMatrixClose(result, IDENTITY);
    });

    it("should correctly invert perspective matrix", () => {
      const p = Matrix4.perspective(Math.PI / 4, 16 / 9, 0.1, 100);
      const inv = p.inverse();
      const result = p.multiply(inv);
      expectMatrixClose(result, IDENTITY);
    });

    it("should correctly invert lookAt matrix", () => {
      const v = Matrix4.lookAt(
        new Vector3(5, 3, 10),
        new Vector3(0, 0, 0),
        new Vector3(0, 1, 0),
      );
      const inv = v.inverse();
      const result = v.multiply(inv);
      expectMatrixClose(result, IDENTITY);
    });
  });

  describe("transpose", () => {
    it("should return identity for identity matrix", () => {
      const m = new Matrix4();
      const t = m.transpose();
      expectMatrixClose(t, IDENTITY);
    });

    it("should swap rows and columns", () => {
      const m = Matrix4.translation(new Vector3(1, 2, 3));
      const t = m.transpose();
      // Original: translation is at column 3 (indices 12, 13, 14)
      // Transposed: should be at row 3 (indices 3, 7, 11)
      expect(t.data[3]).toBeCloseTo(1);
      expect(t.data[7]).toBeCloseTo(2);
      expect(t.data[11]).toBeCloseTo(3);
      // Original positions should now be 0
      expect(t.data[12]).toBeCloseTo(0);
      expect(t.data[13]).toBeCloseTo(0);
      expect(t.data[14]).toBeCloseTo(0);
    });

    it("should satisfy (M^T)^T = M", () => {
      const m = new Matrix4()
        .translate(new Vector3(1, 2, 3))
        .scale(new Vector3(2, 3, 4))
        .rotateY(Math.PI / 4);
      const tt = m.transpose().transpose();
      expectMatrixClose(tt, Array.from(m.data));
    });

    it("should satisfy (A*B)^T = B^T * A^T", () => {
      const a = Matrix4.translation(new Vector3(1, 2, 3));
      const b = Matrix4.scaling(new Vector3(2, 3, 4));
      const abT = a.multiply(b).transpose();
      const bTaT = b.transpose().multiply(a.transpose());
      expectMatrixClose(abT, Array.from(bTaT.data));
    });

    it("should create correct normal matrix with inverse transpose", () => {
      // For non-uniform scaling, normals need inverse transpose
      const s = Matrix4.scaling(new Vector3(2, 1, 1)); // non-uniform scale
      const normalMatrix = s.inverse().transpose();
      // For scaling (2,1,1), inverse is (0.5,1,1), transpose of diagonal is same
      expect(normalMatrix.data[0]).toBeCloseTo(0.5);
      expect(normalMatrix.data[5]).toBeCloseTo(1);
      expect(normalMatrix.data[10]).toBeCloseTo(1);
    });
  });

  describe("transformPoint", () => {
    it("should apply identity transformation", () => {
      const m = new Matrix4();
      const v = new Vector3(1, 2, 3);
      const result = m.transformPoint(v);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(2);
      expect(result.z).toBeCloseTo(3);
    });

    it("should apply translation to point", () => {
      const m = Matrix4.translation(new Vector3(5, 10, 15));
      const v = new Vector3(1, 2, 3);
      const result = m.transformPoint(v);
      expect(result.x).toBeCloseTo(6);
      expect(result.y).toBeCloseTo(12);
      expect(result.z).toBeCloseTo(18);
    });

    it("should apply scaling to point", () => {
      const m = Matrix4.scaling(new Vector3(2, 3, 4));
      const v = new Vector3(1, 2, 3);
      const result = m.transformPoint(v);
      expect(result.x).toBeCloseTo(2);
      expect(result.y).toBeCloseTo(6);
      expect(result.z).toBeCloseTo(12);
    });

    it("should apply rotation to point", () => {
      const m = Matrix4.rotationZ(Math.PI / 2);
      const v = new Vector3(1, 0, 0);
      const result = m.transformPoint(v);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(1);
      expect(result.z).toBeCloseTo(0);
    });

    it("should apply combined transformations in correct order", () => {
      const m = new Matrix4()
        .scale(new Vector3(2, 2, 2))
        .translate(new Vector3(1, 0, 0));
      const v = new Vector3(1, 0, 0);
      const result = m.transformPoint(v);
      // M = S * T (scale applied first to identity, then translate)
      // Point: (S * T) * v = S * (T * v) = S * (2,0,0) = (4,0,0)
      expect(result.x).toBeCloseTo(4);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(0);
    });

    it("should perform perspective division correctly", () => {
      const m = Matrix4.perspective(Math.PI / 4, 1, 0.1, 100);
      const v = new Vector3(0, 0, -1);
      const result = m.transformPoint(v);
      // After perspective transformation, coordinates should be normalized
      expect(Number.isNaN(result.x)).toBe(false);
      expect(Number.isNaN(result.y)).toBe(false);
      expect(Number.isNaN(result.z)).toBe(false);
    });

    it("should handle perspective division when w is near zero", () => {
      const m = new Matrix4();
      // Manually create a matrix that produces w ≈ 0
      m.data[3] = 0;
      m.data[7] = 0;
      m.data[11] = 0;
      m.data[15] = 1e-11; // Very small w
      const v = new Vector3(1, 2, 3);
      const result = m.transformPoint(v);
      // Should not divide by w when it's too small
      expect(Number.isNaN(result.x)).toBe(false);
      expect(Number.isNaN(result.y)).toBe(false);
      expect(Number.isNaN(result.z)).toBe(false);
    });

    it("should transform point through view-projection pipeline", () => {
      const view = Matrix4.lookAt(
        new Vector3(0, 0, 5),
        new Vector3(0, 0, 0),
        new Vector3(0, 1, 0),
      );
      const proj = Matrix4.perspective(Math.PI / 4, 1, 0.1, 100);
      const vp = proj.multiply(view);
      const v = new Vector3(0, 0, 0); // Point at origin
      const result = vp.transformPoint(v);
      expect(Number.isNaN(result.x)).toBe(false);
      expect(Number.isNaN(result.y)).toBe(false);
      expect(Number.isNaN(result.z)).toBe(false);
    });
  });

  describe("transformDirection", () => {
    it("should apply identity transformation", () => {
      const m = new Matrix4();
      const v = new Vector3(1, 2, 3);
      const result = m.transformDirection(v);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(2);
      expect(result.z).toBeCloseTo(3);
    });

    it("should ignore translation when transforming direction", () => {
      const m = Matrix4.translation(new Vector3(100, 200, 300));
      const v = new Vector3(1, 2, 3);
      const result = m.transformDirection(v);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(2);
      expect(result.z).toBeCloseTo(3);
    });

    it("should apply scaling to direction", () => {
      const m = Matrix4.scaling(new Vector3(2, 3, 4));
      const v = new Vector3(1, 2, 3);
      const result = m.transformDirection(v);
      expect(result.x).toBeCloseTo(2);
      expect(result.y).toBeCloseTo(6);
      expect(result.z).toBeCloseTo(12);
    });

    it("should apply rotation to direction", () => {
      const m = Matrix4.rotationY(Math.PI / 2);
      const v = new Vector3(1, 0, 0);
      const result = m.transformDirection(v);
      // Right-handed Y rotation by 90°: X-axis rotates to -Z-axis
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(-1);
    });

    it("should preserve direction length with rotation only", () => {
      const m = Matrix4.rotationZ(Math.PI / 3);
      const v = new Vector3(1, 0, 0);
      const result = m.transformDirection(v);
      expect(result.length).toBeCloseTo(v.length);
    });

    it("should transform unit vectors correctly", () => {
      const m = Matrix4.rotationX(Math.PI / 2);
      const up = new Vector3(0, 1, 0);
      const result = m.transformDirection(up);
      // Y-axis rotates to Z-axis when rotating around X by 90°
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(0);
      expect(result.z).toBeCloseTo(1);
    });

    it("should correctly transform normals with uniform scale", () => {
      const m = Matrix4.scaling(new Vector3(2, 2, 2));
      const normal = new Vector3(0, 1, 0);
      const result = m.transformDirection(normal);
      // Direction is scaled but still points up
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(2);
      expect(result.z).toBeCloseTo(0);
    });

    it("should transform forward vector correctly in view matrix", () => {
      const m = Matrix4.lookAt(
        new Vector3(0, 0, 5),
        new Vector3(0, 0, 0),
        new Vector3(0, 1, 0),
      );
      const forward = new Vector3(0, 0, -1);
      const result = m.transformDirection(forward);
      expect(Number.isNaN(result.x)).toBe(false);
      expect(Number.isNaN(result.y)).toBe(false);
      expect(Number.isNaN(result.z)).toBe(false);
    });

    it("should differ from transformPoint for translated matrices", () => {
      const m = new Matrix4().translate(new Vector3(10, 20, 30));
      const v = new Vector3(1, 0, 0);
      const point = m.transformPoint(v);
      const direction = m.transformDirection(v);
      // Point should be translated
      expect(point.x).toBeCloseTo(11);
      // Direction should not be translated
      expect(direction.x).toBeCloseTo(1);
      expect(direction.y).toBeCloseTo(0);
      expect(direction.z).toBeCloseTo(0);
    });
  });
});
