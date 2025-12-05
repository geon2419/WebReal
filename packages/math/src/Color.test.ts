import { describe, it, expect } from "vitest";
import { Color } from "./Color";

describe("Color", () => {
  describe("constructor", () => {
    it("initializes with default values (0, 0, 0, 1)", () => {
      const c = new Color();
      expect(c.r).toBe(0);
      expect(c.g).toBe(0);
      expect(c.b).toBe(0);
      expect(c.a).toBe(1);
    });

    it("initializes with RGB values, alpha defaults to 1", () => {
      const c = new Color(1, 0.5, 0.3);
      expect(c.r).toBe(1);
      expect(c.g).toBe(0.5);
      expect(c.b).toBe(0.3);
      expect(c.a).toBe(1);
    });

    it("initializes with RGBA values", () => {
      const c = new Color(1, 0.5, 0.3, 0.8);
      expect(c.r).toBe(1);
      expect(c.g).toBe(0.5);
      expect(c.b).toBe(0.3);
      expect(c.a).toBe(0.8);
    });
  });

  describe("toArray", () => {
    it("returns RGB tuple", () => {
      const c = new Color(1, 0.5, 0.3, 0.8);
      const arr = c.toArray();
      expect(arr).toEqual([1, 0.5, 0.3]);
      expect(arr.length).toBe(3);
    });
  });

  describe("toArray4", () => {
    it("returns RGBA tuple", () => {
      const c = new Color(1, 0.5, 0.3, 0.8);
      const arr = c.toArray4();
      expect(arr).toEqual([1, 0.5, 0.3, 0.8]);
      expect(arr.length).toBe(4);
    });
  });

  describe("fromArray", () => {
    it("creates Color from RGB array, alpha defaults to 1", () => {
      const c = Color.fromArray([1, 0.5, 0.3]);
      expect(c.r).toBe(1);
      expect(c.g).toBe(0.5);
      expect(c.b).toBe(0.3);
      expect(c.a).toBe(1);
    });

    it("creates Color from RGBA array", () => {
      const c = Color.fromArray([1, 0.5, 0.3, 0.8]);
      expect(c.r).toBe(1);
      expect(c.g).toBe(0.5);
      expect(c.b).toBe(0.3);
      expect(c.a).toBe(0.8);
    });
  });

  describe("immutability", () => {
    it("properties cannot be directly modified", () => {
      const c = new Color(1, 0, 0);
      // @ts-expect-error - readonly 속성 테스트
      expect(() => (c.r = 0.5)).toThrow();
    });
  });

  describe("toString", () => {
    it("returns string representation", () => {
      const c = new Color(1, 0.5, 0.3, 0.8);
      expect(c.toString()).toBe("Color(1, 0.5, 0.3, 0.8)");
    });
  });

  describe("toFloat32Array", () => {
    it("returns RGBA Float32Array", () => {
      const c = new Color(1, 0.5, 0.3, 0.8);
      const arr = c.toFloat32Array();
      expect(arr).toBeInstanceOf(Float32Array);
      expect(arr.length).toBe(4);
      expect(arr[0]).toBeCloseTo(1, 5);
      expect(arr[1]).toBeCloseTo(0.5, 5);
      expect(arr[2]).toBeCloseTo(0.3, 5);
      expect(arr[3]).toBeCloseTo(0.8, 5);
    });
  });

  describe("from", () => {
    it("creates Color from RGB tuple", () => {
      const c = Color.from([1, 0.5, 0.3]);
      expect(c.r).toBe(1);
      expect(c.g).toBe(0.5);
      expect(c.b).toBe(0.3);
      expect(c.a).toBe(1);
    });

    it("creates Color from RGBA tuple", () => {
      const c = Color.from([1, 0.5, 0.3, 0.8]);
      expect(c.r).toBe(1);
      expect(c.g).toBe(0.5);
      expect(c.b).toBe(0.3);
      expect(c.a).toBe(0.8);
    });

    it("creates Color from Color instance with same values", () => {
      const original = new Color(1, 0.5, 0.3, 0.8);
      const result = Color.from(original);
      expect(result.r).toBe(original.r);
      expect(result.g).toBe(original.g);
      expect(result.b).toBe(original.b);
      expect(result.a).toBe(original.a);
    });
  });

  describe("fromHex", () => {
    it("creates Color from #RRGGBB format", () => {
      const c = Color.fromHex("#ff8000");
      expect(c.r).toBe(1);
      expect(c.g).toBeCloseTo(0.502, 2);
      expect(c.b).toBe(0);
      expect(c.a).toBe(1);
    });

    it("creates Color from #RGB format", () => {
      const c = Color.fromHex("#f80");
      expect(c.r).toBe(1);
      expect(c.g).toBeCloseTo(0.533, 2);
      expect(c.b).toBe(0);
    });

    it("works without # prefix", () => {
      const c = Color.fromHex("ff0000");
      expect(c.r).toBe(1);
      expect(c.g).toBe(0);
      expect(c.b).toBe(0);
    });
  });

  describe("toHex", () => {
    it("converts Color to hex string", () => {
      const c = new Color(1, 0, 0);
      expect(c.toHex()).toBe("#ff0000");
    });

    it("correctly converts middle values", () => {
      const c = new Color(0.5, 0.5, 0.5);
      expect(c.toHex()).toBe("#808080");
    });
  });

  describe("clone", () => {
    it("creates new Color with same values", () => {
      const original = new Color(1, 0.5, 0.3, 0.8);
      const cloned = original.clone();
      expect(cloned).not.toBe(original);
      expect(cloned.r).toBe(original.r);
      expect(cloned.g).toBe(original.g);
      expect(cloned.b).toBe(original.b);
      expect(cloned.a).toBe(original.a);
    });
  });

  describe("equals", () => {
    it("returns true for identical values", () => {
      const a = new Color(1, 0.5, 0.3, 0.8);
      const b = new Color(1, 0.5, 0.3, 0.8);
      expect(a.equals(b)).toBe(true);
    });

    it("returns false for different values", () => {
      const a = new Color(1, 0.5, 0.3, 0.8);
      const b = new Color(1, 0.5, 0.3, 0.9);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("predefined colors", () => {
    it("Color.RED", () => {
      expect(Color.RED.r).toBe(1);
      expect(Color.RED.g).toBe(0);
      expect(Color.RED.b).toBe(0);
    });

    it("Color.WHITE", () => {
      expect(Color.WHITE.r).toBe(1);
      expect(Color.WHITE.g).toBe(1);
      expect(Color.WHITE.b).toBe(1);
    });

    it("Color.BLACK", () => {
      expect(Color.BLACK.r).toBe(0);
      expect(Color.BLACK.g).toBe(0);
      expect(Color.BLACK.b).toBe(0);
    });
  });
});
