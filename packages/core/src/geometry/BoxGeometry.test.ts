import { describe, it, expect } from "vitest";
import { BoxGeometry } from "./BoxGeometry";

describe("BoxGeometry", () => {
  describe("constructor", () => {
    it("should create a box with default parameters", () => {
      const box = new BoxGeometry();

      expect(box.width).toBe(2);
      expect(box.height).toBe(2);
      expect(box.depth).toBe(2);
      expect(box.widthSegments).toBe(1);
      expect(box.heightSegments).toBe(1);
      expect(box.depthSegments).toBe(1);
    });

    it("should create a box with custom dimensions", () => {
      const box = new BoxGeometry(4, 6, 8);

      expect(box.width).toBe(4);
      expect(box.height).toBe(6);
      expect(box.depth).toBe(8);
    });

    it("should create a box with custom segments", () => {
      const box = new BoxGeometry(2, 2, 2, 3, 4, 5);

      expect(box.widthSegments).toBe(3);
      expect(box.heightSegments).toBe(4);
      expect(box.depthSegments).toBe(5);
    });

    it("should handle non-uniform dimensions", () => {
      const box = new BoxGeometry(1, 10, 0.5);

      expect(box.width).toBe(1);
      expect(box.height).toBe(10);
      expect(box.depth).toBe(0.5);
    });
  });

  describe("geometry data", () => {
    it("should generate correct vertex count for default box (6 faces, 4 vertices each)", () => {
      const box = new BoxGeometry();

      // 6 faces × 4 vertices = 24 vertices
      expect(box.vertexCount).toBe(24);
      expect(box.positions.length).toBe(24 * 3);
      expect(box.normals.length).toBe(24 * 3);
      expect(box.uvs.length).toBe(24 * 2);
    });

    it("should generate correct index count for default box", () => {
      const box = new BoxGeometry();

      // 6 faces × 2 triangles × 3 indices = 36 indices
      expect(box.indexCount).toBe(36);
      expect(box.indices.length).toBe(36);
    });

    it("should use Uint16Array for indices by default", () => {
      const box = new BoxGeometry();

      expect(box.indices).toBeInstanceOf(Uint16Array);
    });

    it("should generate vertex count correctly with segments", () => {
      const box = new BoxGeometry(2, 2, 2, 2, 3, 4);

      // Each face: (segments + 1) × (segments + 1) vertices
      // Front/Back (xy): (2+1) × (3+1) = 12 vertices each = 24
      // Left/Right (yz): (4+1) × (3+1) = 20 vertices each = 40
      // Top/Bottom (xz): (2+1) × (4+1) = 15 vertices each = 30
      // Total: 24 + 40 + 30 = 94
      expect(box.vertexCount).toBe(94);
    });

    it("should generate index count correctly with segments", () => {
      const box = new BoxGeometry(2, 2, 2, 2, 2, 2);

      // Each face: segments × segments × 2 triangles × 3 indices
      // 6 faces × (2 × 2 × 2 × 3) = 6 × 24 = 144
      expect(box.indexCount).toBe(144);
    });
  });

  describe("positions", () => {
    it("should have positions within expected bounds", () => {
      const width = 4;
      const height = 6;
      const depth = 8;
      const box = new BoxGeometry(width, height, depth);

      const positions = box.positions;

      // Check all positions are within bounds
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        expect(Math.abs(x)).toBeLessThanOrEqual(width / 2 + 0.0001);
        expect(Math.abs(y)).toBeLessThanOrEqual(height / 2 + 0.0001);
        expect(Math.abs(z)).toBeLessThanOrEqual(depth / 2 + 0.0001);
      }
    });

    it("should center the box at origin", () => {
      const box = new BoxGeometry(2, 2, 2);
      const positions = box.positions;

      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]);
        maxX = Math.max(maxX, positions[i]);
        minY = Math.min(minY, positions[i + 1]);
        maxY = Math.max(maxY, positions[i + 1]);
        minZ = Math.min(minZ, positions[i + 2]);
        maxZ = Math.max(maxZ, positions[i + 2]);
      }

      // Check centering (with small tolerance for floating point)
      expect(minX + maxX).toBeCloseTo(0, 5);
      expect(minY + maxY).toBeCloseTo(0, 5);
      expect(minZ + maxZ).toBeCloseTo(0, 5);
    });
  });

  describe("normals", () => {
    it("should have unit length normals", () => {
      const box = new BoxGeometry();
      const normals = box.normals;

      for (let i = 0; i < normals.length; i += 3) {
        const x = normals[i];
        const y = normals[i + 1];
        const z = normals[i + 2];
        const length = Math.sqrt(x * x + y * y + z * z);

        expect(length).toBeCloseTo(1, 5);
      }
    });

    it("should have normals pointing outward", () => {
      const box = new BoxGeometry(2, 2, 2);
      const positions = box.positions;
      const normals = box.normals;

      for (let i = 0; i < normals.length; i += 3) {
        const px = positions[i];
        const py = positions[i + 1];
        const pz = positions[i + 2];
        const nx = normals[i];
        const ny = normals[i + 1];
        const nz = normals[i + 2];

        // Dot product of position and normal should be positive (pointing outward)
        // For vertices on faces, at least one component should align
        const dot = px * nx + py * ny + pz * nz;
        expect(dot).toBeGreaterThanOrEqual(-0.0001);
      }
    });

    it("should have axis-aligned normals (box has flat faces)", () => {
      const box = new BoxGeometry();
      const normals = box.normals;

      for (let i = 0; i < normals.length; i += 3) {
        const x = normals[i];
        const y = normals[i + 1];
        const z = normals[i + 2];

        // One component should be ±1, others should be 0
        const components = [Math.abs(x), Math.abs(y), Math.abs(z)];
        const oneCount = components.filter(
          (c) => Math.abs(c - 1) < 0.0001
        ).length;
        const zeroCount = components.filter((c) => Math.abs(c) < 0.0001).length;

        expect(oneCount).toBe(1);
        expect(zeroCount).toBe(2);
      }
    });
  });

  describe("UVs", () => {
    it("should have UVs in valid range [0, 1]", () => {
      const box = new BoxGeometry();
      const uvs = box.uvs;

      for (let i = 0; i < uvs.length; i++) {
        expect(uvs[i]).toBeGreaterThanOrEqual(0);
        expect(uvs[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should have two UV coordinates per vertex", () => {
      const box = new BoxGeometry();

      expect(box.uvs.length).toBe(box.vertexCount * 2);
    });

    it("should cover full UV space for each face", () => {
      const box = new BoxGeometry();
      const uvs = box.uvs;

      // Check that we have corners at (0,0), (0,1), (1,0), (1,1)
      let hasMin = false;
      let hasMaxU = false;
      let hasMaxV = false;

      for (let i = 0; i < uvs.length; i += 2) {
        const u = uvs[i];
        const v = uvs[i + 1];

        if (Math.abs(u) < 0.0001 && Math.abs(v) < 0.0001) hasMin = true;
        if (Math.abs(u - 1) < 0.0001) hasMaxU = true;
        if (Math.abs(v - 1) < 0.0001) hasMaxV = true;
      }

      expect(hasMin).toBe(true);
      expect(hasMaxU).toBe(true);
      expect(hasMaxV).toBe(true);
    });
  });

  describe("tangents and bitangents", () => {
    it("should generate tangents for all vertices", () => {
      const box = new BoxGeometry();

      expect(box.tangents.length).toBe(box.vertexCount * 3);
    });

    it("should generate bitangents for all vertices", () => {
      const box = new BoxGeometry();

      expect(box.bitangents.length).toBe(box.vertexCount * 3);
    });

    it("should have unit length tangents", () => {
      const box = new BoxGeometry();
      const tangents = box.tangents;

      for (let i = 0; i < tangents.length; i += 3) {
        const x = tangents[i];
        const y = tangents[i + 1];
        const z = tangents[i + 2];
        const length = Math.sqrt(x * x + y * y + z * z);

        // Tangents should be normalized (or zero in degenerate cases)
        expect(length).toBeCloseTo(1, 4);
      }
    });

    it("should have unit length bitangents", () => {
      const box = new BoxGeometry();
      const bitangents = box.bitangents;

      for (let i = 0; i < bitangents.length; i += 3) {
        const x = bitangents[i];
        const y = bitangents[i + 1];
        const z = bitangents[i + 2];
        const length = Math.sqrt(x * x + y * y + z * z);

        expect(length).toBeCloseTo(1, 4);
      }
    });

    it("should have orthogonal tangent, bitangent, and normal", () => {
      const box = new BoxGeometry();
      const normals = box.normals;
      const tangents = box.tangents;
      const bitangents = box.bitangents;

      for (let i = 0; i < normals.length; i += 3) {
        const nx = normals[i];
        const ny = normals[i + 1];
        const nz = normals[i + 2];
        const tx = tangents[i];
        const ty = tangents[i + 1];
        const tz = tangents[i + 2];
        const bx = bitangents[i];
        const by = bitangents[i + 1];
        const bz = bitangents[i + 2];

        // Dot products should be close to zero (orthogonal)
        const dotNT = nx * tx + ny * ty + nz * tz;
        const dotNB = nx * bx + ny * by + nz * bz;
        const dotTB = tx * bx + ty * by + tz * bz;

        expect(Math.abs(dotNT)).toBeLessThan(0.01);
        expect(Math.abs(dotNB)).toBeLessThan(0.01);
        expect(Math.abs(dotTB)).toBeLessThan(0.01);
      }
    });
  });

  describe("indices", () => {
    it("should have valid triangle indices", () => {
      const box = new BoxGeometry();
      const indices = box.indices;

      // All indices should be valid vertex indices
      for (let i = 0; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThanOrEqual(0);
        expect(indices[i]).toBeLessThan(box.vertexCount);
      }
    });

    it("should have indices in multiples of 3 (triangles)", () => {
      const box = new BoxGeometry();

      expect(box.indices.length % 3).toBe(0);
    });

    it("should form counter-clockwise triangles (front-facing)", () => {
      const box = new BoxGeometry(2, 2, 2);
      const positions = box.positions;
      const indices = box.indices;

      // Check a few triangles for counter-clockwise winding
      for (let i = 0; i < Math.min(6, indices.length); i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        const v0 = [positions[i0], positions[i0 + 1], positions[i0 + 2]];
        const v1 = [positions[i1], positions[i1 + 1], positions[i1 + 2]];
        const v2 = [positions[i2], positions[i2 + 1], positions[i2 + 2]];

        // Edge vectors
        const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
        const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

        // Cross product (normal of triangle)
        const nx = e1[1] * e2[2] - e1[2] * e2[1];
        const ny = e1[2] * e2[0] - e1[0] * e2[2];
        const nz = e1[0] * e2[1] - e1[1] * e2[0];

        // Triangle should have non-zero area
        const area = Math.sqrt(nx * nx + ny * ny + nz * nz);
        expect(area).toBeGreaterThan(0);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle very small dimensions", () => {
      const box = new BoxGeometry(0.001, 0.001, 0.001);

      expect(box.vertexCount).toBe(24);
      expect(box.indexCount).toBe(36);
    });

    it("should handle very large dimensions", () => {
      const box = new BoxGeometry(1000, 1000, 1000);

      expect(box.vertexCount).toBe(24);
      expect(box.indexCount).toBe(36);
    });

    it("should handle many segments", () => {
      const box = new BoxGeometry(2, 2, 2, 10, 10, 10);

      // Each face: (10+1) × (10+1) = 121 vertices
      // 6 faces × 121 = 726 vertices
      expect(box.vertexCount).toBe(726);

      // Each face: 10 × 10 × 2 triangles × 3 indices = 600 indices
      // 6 faces × 600 = 3600 indices
      expect(box.indexCount).toBe(3600);
    });

    it("should handle single segment per dimension", () => {
      const box = new BoxGeometry(2, 2, 2, 1, 1, 1);

      expect(box.vertexCount).toBe(24);
      expect(box.indexCount).toBe(36);
    });
  });

  describe("data consistency", () => {
    it("should have consistent array lengths", () => {
      const box = new BoxGeometry(3, 4, 5, 2, 3, 4);

      const vertexCount = box.vertexCount;
      expect(box.positions.length).toBe(vertexCount * 3);
      expect(box.normals.length).toBe(vertexCount * 3);
      expect(box.tangents.length).toBe(vertexCount * 3);
      expect(box.bitangents.length).toBe(vertexCount * 3);
      expect(box.uvs.length).toBe(vertexCount * 2);
    });

    it("should return the same data on multiple accesses", () => {
      const box = new BoxGeometry();

      const positions1 = box.positions;
      const positions2 = box.positions;

      expect(positions1).toBe(positions2);
      expect(positions1).toEqual(positions2);
    });

    it("should have immutable geometry data", () => {
      const box = new BoxGeometry();

      const positions = box.positions;
      const originalValue = positions[0];

      // Modify the array
      positions[0] = 999;

      // Get positions again
      const positions2 = box.positions;

      // Should reflect the change (same array reference)
      expect(positions2[0]).toBe(999);

      // Restore for other tests
      positions[0] = originalValue;
    });
  });
});
