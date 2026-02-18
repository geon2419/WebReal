import { describe, it, expect } from "bun:test";
import { Color, Vector3 } from "@web-real/math";
import { DirectionalLight } from "./DirectionalLight";

describe("DirectionalLight", () => {
  describe("constructor", () => {
    it("should initialize with default values (down direction, white color, intensity 1)", () => {
      const light = new DirectionalLight();
      expect(light.direction.x).toBe(0);
      expect(light.direction.y).toBe(-1);
      expect(light.direction.z).toBe(0);
      expect(light.color.r).toBe(1);
      expect(light.color.g).toBe(1);
      expect(light.color.b).toBe(1);
      expect(light.intensity).toBe(1);
    });

    it("should initialize with given direction and default color/intensity", () => {
      const direction = new Vector3(1, 0, 0);
      const light = new DirectionalLight(direction);
      expect(light.direction.x).toBe(1);
      expect(light.direction.y).toBe(0);
      expect(light.direction.z).toBe(0);
      expect(light.color.r).toBe(1);
      expect(light.color.g).toBe(1);
      expect(light.color.b).toBe(1);
      expect(light.intensity).toBe(1);
    });

    it("should initialize with all parameters", () => {
      const direction = new Vector3(0, 0, 1);
      const color = new Color(0.5, 0.3, 0.8);
      const light = new DirectionalLight(direction, color, 2.5);
      expect(light.direction.x).toBe(0);
      expect(light.direction.y).toBe(0);
      expect(light.direction.z).toBe(1);
      expect(light.color.r).toBe(0.5);
      expect(light.color.g).toBe(0.3);
      expect(light.color.b).toBe(0.8);
      expect(light.intensity).toBe(2.5);
    });

    it("should normalize the direction vector", () => {
      const direction = new Vector3(3, 4, 0);
      const light = new DirectionalLight(direction);
      const length = Math.sqrt(
        light.direction.x ** 2 +
          light.direction.y ** 2 +
          light.direction.z ** 2,
      );
      expect(length).toBeCloseTo(1, 6);
    });

    it("should normalize non-unit direction vectors correctly", () => {
      const direction = new Vector3(2, 2, 1);
      const light = new DirectionalLight(direction);
      const expectedLength = Math.sqrt(2 ** 2 + 2 ** 2 + 1 ** 2);
      expect(light.direction.x).toBeCloseTo(2 / expectedLength, 6);
      expect(light.direction.y).toBeCloseTo(2 / expectedLength, 6);
      expect(light.direction.z).toBeCloseTo(1 / expectedLength, 6);
    });

    it("should throw error for zero-length direction vector", () => {
      const direction = new Vector3(0, 0, 0);
      expect(() => new DirectionalLight(direction)).toThrow(
        "DirectionalLight: direction vector must be non-zero.",
      );
    });

    it("should throw error for near-zero direction vector", () => {
      const direction = new Vector3(1e-9, 1e-10, 0);
      expect(() => new DirectionalLight(direction)).toThrow(
        "DirectionalLight: direction vector must be non-zero.",
      );
    });
  });

  describe("direction property", () => {
    it("should allow direction to be modified", () => {
      const light = new DirectionalLight();
      light.direction = new Vector3(1, 1, 1).normalize();
      expect(light.direction.x).toBeCloseTo(1 / Math.sqrt(3), 6);
      expect(light.direction.y).toBeCloseTo(1 / Math.sqrt(3), 6);
      expect(light.direction.z).toBeCloseTo(1 / Math.sqrt(3), 6);
    });

    it("should allow direction components to be modified directly", () => {
      const light = new DirectionalLight();
      light.direction.x = 0.5;
      light.direction.y = 0.5;
      light.direction.z = 0.7071;
      expect(light.direction.x).toBeCloseTo(0.5, 4);
      expect(light.direction.y).toBeCloseTo(0.5, 4);
      expect(light.direction.z).toBeCloseTo(0.7071, 4);
    });
  });

  describe("edge cases", () => {
    it("should handle negative direction components", () => {
      const direction = new Vector3(-1, -1, -1);
      const light = new DirectionalLight(direction);
      const expectedLength = Math.sqrt(3);
      expect(light.direction.x).toBeCloseTo(-1 / expectedLength, 6);
      expect(light.direction.y).toBeCloseTo(-1 / expectedLength, 6);
      expect(light.direction.z).toBeCloseTo(-1 / expectedLength, 6);
    });

    it("should handle very small but valid direction vectors", () => {
      const direction = new Vector3(1e-7, 1e-7, 1e-7);
      const light = new DirectionalLight(direction);
      const length = Math.sqrt(
        light.direction.x ** 2 +
          light.direction.y ** 2 +
          light.direction.z ** 2,
      );
      expect(length).toBeCloseTo(1, 6);
    });

    it("should handle very large direction vectors", () => {
      const direction = new Vector3(1000, 2000, 3000);
      const light = new DirectionalLight(direction);
      const length = Math.sqrt(
        light.direction.x ** 2 +
          light.direction.y ** 2 +
          light.direction.z ** 2,
      );
      expect(length).toBeCloseTo(1, 6);
    });

    it("should work with intensity zero", () => {
      const direction = new Vector3(0, -1, 0);
      const color = new Color(1, 1, 1);
      const light = new DirectionalLight(direction, color, 0);
      expect(light.intensity).toBe(0);
      expect(light.direction.y).toBe(-1);
    });
  });

  describe("inheritance from Light", () => {
    it("should inherit color and intensity properties", () => {
      const light = new DirectionalLight();
      expect(light.color).toBeDefined();
      expect(light.intensity).toBeDefined();
    });

    it("should allow inherited properties to be modified", () => {
      const light = new DirectionalLight();
      light.color = new Color(0.1, 0.2, 0.3);
      light.intensity = 5.0;
      expect(light.color.r).toBe(0.1);
      expect(light.color.g).toBe(0.2);
      expect(light.color.b).toBe(0.3);
      expect(light.intensity).toBe(5.0);
    });
  });
});
