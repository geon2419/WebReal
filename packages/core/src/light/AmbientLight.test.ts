import { describe, it, expect } from "bun:test";
import { Color } from "@web-real/math";
import { AmbientLight } from "./AmbientLight";
import { Light } from "./Light";

describe("AmbientLight", () => {
  describe("constructor", () => {
    it("should initialize with default values (white color, intensity 0.1)", () => {
      const light = new AmbientLight();
      expect(light.color.r).toBe(1);
      expect(light.color.g).toBe(1);
      expect(light.color.b).toBe(1);
      expect(light.intensity).toBe(0.1);
    });

    it("should initialize with given color and default intensity", () => {
      const color = new Color(0.5, 0.3, 0.8);
      const light = new AmbientLight(color);
      expect(light.color.r).toBe(0.5);
      expect(light.color.g).toBe(0.3);
      expect(light.color.b).toBe(0.8);
      expect(light.intensity).toBe(0.1);
    });

    it("should initialize with given color and intensity", () => {
      const color = new Color(0.5, 0.3, 0.8);
      const light = new AmbientLight(color, 0.5);
      expect(light.color.r).toBe(0.5);
      expect(light.color.g).toBe(0.3);
      expect(light.color.b).toBe(0.8);
      expect(light.intensity).toBe(0.5);
    });

    it("should initialize with zero intensity", () => {
      const color = new Color(1, 1, 1);
      const light = new AmbientLight(color, 0);
      expect(light.intensity).toBe(0);
    });

    it("should initialize with high intensity", () => {
      const color = new Color(1, 1, 1);
      const light = new AmbientLight(color, 1.0);
      expect(light.intensity).toBe(1.0);
    });

    it("should initialize with very low intensity", () => {
      const color = new Color(1, 1, 1);
      const light = new AmbientLight(color, 0.01);
      expect(light.intensity).toBeCloseTo(0.01, 5);
    });
  });

  describe("inheritance", () => {
    it("should be an instance of Light", () => {
      const light = new AmbientLight();
      expect(light).toBeInstanceOf(Light);
    });
  });

  describe("color property", () => {
    it("should allow updating color after creation", () => {
      const light = new AmbientLight();
      light.color = new Color(0.2, 0.4, 0.6);
      expect(light.color.r).toBe(0.2);
      expect(light.color.g).toBe(0.4);
      expect(light.color.b).toBe(0.6);
    });

    it("should handle black color (no ambient contribution)", () => {
      const light = new AmbientLight(new Color(0, 0, 0));
      expect(light.color.r).toBe(0);
      expect(light.color.g).toBe(0);
      expect(light.color.b).toBe(0);
    });

    it("should handle colored ambient light", () => {
      const light = new AmbientLight(new Color(1, 0, 0)); // Red ambient
      expect(light.color.r).toBe(1);
      expect(light.color.g).toBe(0);
      expect(light.color.b).toBe(0);
    });
  });

  describe("intensity property", () => {
    it("should allow updating intensity after creation", () => {
      const light = new AmbientLight();
      light.intensity = 0.5;
      expect(light.intensity).toBe(0.5);
    });

    it("should handle negative intensity", () => {
      const light = new AmbientLight(new Color(1, 1, 1), -0.1);
      expect(light.intensity).toBe(-0.1);
    });

    it("should handle intensity greater than 1", () => {
      const light = new AmbientLight(new Color(1, 1, 1), 2.0);
      expect(light.intensity).toBe(2.0);
    });
  });

  describe("typical usage", () => {
    it("should work with typical ambient light settings (low intensity white)", () => {
      const light = new AmbientLight(new Color(1, 1, 1), 0.1);
      expect(light.color.r).toBe(1);
      expect(light.color.g).toBe(1);
      expect(light.color.b).toBe(1);
      expect(light.intensity).toBe(0.1);
    });

    it("should work with warm ambient light", () => {
      const light = new AmbientLight(new Color(1.0, 0.9, 0.8), 0.15);
      expect(light.color.r).toBe(1.0);
      expect(light.color.g).toBe(0.9);
      expect(light.color.b).toBe(0.8);
      expect(light.intensity).toBe(0.15);
    });

    it("should work with cool ambient light", () => {
      const light = new AmbientLight(new Color(0.8, 0.9, 1.0), 0.2);
      expect(light.color.r).toBe(0.8);
      expect(light.color.g).toBe(0.9);
      expect(light.color.b).toBe(1.0);
      expect(light.intensity).toBe(0.2);
    });
  });
});
