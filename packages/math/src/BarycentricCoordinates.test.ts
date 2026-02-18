import { describe, it, expect } from "bun:test";
import { BarycentricCoordinates } from "./BarycentricCoordinates";
import { Vector2 } from "./Vector2";
import { Vector3 } from "./Vector3";

describe("BarycentricCoordinates", () => {
  describe("calculate", () => {
    it("should calculate barycentric coordinates for a point at first vertex", () => {
      const v0 = new Vector3(0, 0, 0);
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const point = new Vector3(0, 0, 0);

      const result = BarycentricCoordinates.calculate(point, v0, v1, v2);

      expect(result).not.toBeNull();
      expect(result!.u).toBeCloseTo(1);
      expect(result!.v).toBeCloseTo(0);
      expect(result!.w).toBeCloseTo(0);
    });

    it("should calculate barycentric coordinates for a point at triangle center", () => {
      const v0 = new Vector3(0, 0, 0);
      const v1 = new Vector3(3, 0, 0);
      const v2 = new Vector3(0, 3, 0);
      const center = new Vector3(1, 1, 0);

      const result = BarycentricCoordinates.calculate(center, v0, v1, v2);

      expect(result).not.toBeNull();
      expect(result!.u).toBeCloseTo(1 / 3);
      expect(result!.v).toBeCloseTo(1 / 3);
      expect(result!.w).toBeCloseTo(1 / 3);
    });

    it("should return null for degenerate triangle", () => {
      const v0 = new Vector3(0, 0, 0);
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(2, 0, 0); // Collinear
      const point = new Vector3(0.5, 0, 0);

      const result = BarycentricCoordinates.calculate(point, v0, v1, v2);

      expect(result).toBeNull();
    });

    it("should satisfy u + v + w = 1", () => {
      const v0 = new Vector3(0, 0, 0);
      const v1 = new Vector3(5, 0, 0);
      const v2 = new Vector3(2, 4, 0);
      const point = new Vector3(2, 1, 0);

      const result = BarycentricCoordinates.calculate(point, v0, v1, v2);

      expect(result).not.toBeNull();
      expect(result!.u + result!.v + result!.w).toBeCloseTo(1);
    });
  });

  describe("interpolateUV", () => {
    it("should interpolate UV coordinates correctly", () => {
      const barycentric = { u: 0.5, v: 0.3, w: 0.2 };
      const uv0 = new Vector2(0, 0);
      const uv1 = new Vector2(1, 0);
      const uv2 = new Vector2(0, 1);

      const result = BarycentricCoordinates.interpolateUV(
        barycentric,
        uv0,
        uv1,
        uv2,
      );

      expect(result.x).toBeCloseTo(0.3); // 0.5*0 + 0.3*1 + 0.2*0
      expect(result.y).toBeCloseTo(0.2); // 0.5*0 + 0.3*0 + 0.2*1
    });

    it("should return first vertex UV when u=1", () => {
      const barycentric = { u: 1, v: 0, w: 0 };
      const uv0 = new Vector2(0.5, 0.7);
      const uv1 = new Vector2(1, 0);
      const uv2 = new Vector2(0, 1);

      const result = BarycentricCoordinates.interpolateUV(
        barycentric,
        uv0,
        uv1,
        uv2,
      );

      expect(result.x).toBeCloseTo(0.5);
      expect(result.y).toBeCloseTo(0.7);
    });
  });

  describe("interpolateVector3", () => {
    it("should interpolate Vector3 attributes correctly", () => {
      const barycentric = { u: 0.5, v: 0.3, w: 0.2 };
      const attr0 = new Vector3(1, 0, 0);
      const attr1 = new Vector3(0, 1, 0);
      const attr2 = new Vector3(0, 0, 1);

      const result = BarycentricCoordinates.interpolateVector3(
        barycentric,
        attr0,
        attr1,
        attr2,
      );

      expect(result.x).toBeCloseTo(0.5);
      expect(result.y).toBeCloseTo(0.3);
      expect(result.z).toBeCloseTo(0.2);
    });
  });

  describe("interpolateScalar", () => {
    it("should interpolate scalar values correctly", () => {
      const barycentric = { u: 0.5, v: 0.3, w: 0.2 };
      const val0 = 10;
      const val1 = 20;
      const val2 = 30;

      const result = BarycentricCoordinates.interpolateScalar(
        barycentric,
        val0,
        val1,
        val2,
      );

      expect(result).toBeCloseTo(17); // 0.5*10 + 0.3*20 + 0.2*30
    });
  });
});
