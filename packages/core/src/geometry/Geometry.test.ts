import { describe, it, expect } from "vitest";
import { createIndexArray, getIndexFormat, type IndexArray } from "./Geometry";

describe("Geometry utilities", () => {
  describe("createIndexArray", () => {
    it("should return Uint16Array for empty array", () => {
      const result = createIndexArray([]);
      expect(result).toBeInstanceOf(Uint16Array);
      expect(result.length).toBe(0);
    });

    it("should return Uint16Array for small meshes (max index <= 65535)", () => {
      const indices = [0, 1, 2, 3, 4, 5];
      const result = createIndexArray(indices);
      expect(result).toBeInstanceOf(Uint16Array);
      expect(Array.from(result)).toEqual(indices);
    });

    it("should return Uint16Array when max index is exactly 65535", () => {
      const indices = [0, 65535, 1, 2];
      const result = createIndexArray(indices);
      expect(result).toBeInstanceOf(Uint16Array);
      expect(result[1]).toBe(65535);
    });

    it("should return Uint32Array when max index exceeds 65535", () => {
      const indices = [0, 65536, 1, 2];
      const result = createIndexArray(indices);
      expect(result).toBeInstanceOf(Uint32Array);
      expect(result[1]).toBe(65536);
    });

    it("should return Uint32Array for large meshes", () => {
      // Simulate a large mesh with indices up to 100,000
      const largeIndex = 100000;
      const indices = [0, 1, 2, largeIndex];
      const result = createIndexArray(indices);
      expect(result).toBeInstanceOf(Uint32Array);
      expect(result[3]).toBe(largeIndex);
    });

    it("should handle typical triangle indices", () => {
      // Two triangles forming a quad
      const indices = [0, 1, 2, 2, 3, 0];
      const result = createIndexArray(indices);
      expect(result).toBeInstanceOf(Uint16Array);
      expect(result.length).toBe(6);
    });
  });

  describe("getIndexFormat", () => {
    it("should return 'uint16' for Uint16Array", () => {
      const indices: IndexArray = new Uint16Array([0, 1, 2]);
      expect(getIndexFormat(indices)).toBe("uint16");
    });

    it("should return 'uint32' for Uint32Array", () => {
      const indices: IndexArray = new Uint32Array([0, 1, 2]);
      expect(getIndexFormat(indices)).toBe("uint32");
    });

    it("should return 'uint16' for empty Uint16Array", () => {
      const indices: IndexArray = new Uint16Array(0);
      expect(getIndexFormat(indices)).toBe("uint16");
    });

    it("should return 'uint32' for empty Uint32Array", () => {
      const indices: IndexArray = new Uint32Array(0);
      expect(getIndexFormat(indices)).toBe("uint32");
    });
  });

  describe("IndexArray type compatibility", () => {
    it("should work with both Uint16Array and Uint32Array as IndexArray", () => {
      const uint16: IndexArray = new Uint16Array([0, 1, 2]);
      const uint32: IndexArray = new Uint32Array([0, 1, 2, 65536]);

      // Both should be assignable to IndexArray
      const arrays: IndexArray[] = [uint16, uint32];
      expect(arrays.length).toBe(2);

      // Both should have correct formats
      expect(getIndexFormat(arrays[0])).toBe("uint16");
      expect(getIndexFormat(arrays[1])).toBe("uint32");
    });
  });
});
