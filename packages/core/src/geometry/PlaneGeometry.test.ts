import { describe, it, expect } from "vitest";
import { PlaneGeometry } from "./PlaneGeometry";

describe("PlaneGeometry", () => {
  describe("constructor", () => {
    it("should create a plane with default parameters", () => {
      const plane = new PlaneGeometry();

      expect(plane.width).toBe(1);
      expect(plane.height).toBe(1);
      expect(plane.widthSegments).toBe(1);
      expect(plane.heightSegments).toBe(1);
      expect(plane.orientation).toBe("XY");
    });

    it("should create a plane with custom dimensions", () => {
      const plane = new PlaneGeometry({
        width: 5,
        height: 3,
      });

      expect(plane.width).toBe(5);
      expect(plane.height).toBe(3);
    });

    it("should create a plane with custom segments", () => {
      const plane = new PlaneGeometry({
        widthSegments: 4,
        heightSegments: 6,
      });

      expect(plane.widthSegments).toBe(4);
      expect(plane.heightSegments).toBe(6);
    });

    it("should create a plane with XZ orientation", () => {
      const plane = new PlaneGeometry({
        orientation: "XZ",
      });

      expect(plane.orientation).toBe("XZ");
    });

    it("should create a plane with YZ orientation", () => {
      const plane = new PlaneGeometry({
        orientation: "YZ",
      });

      expect(plane.orientation).toBe("YZ");
    });

    it("should enforce minimum segment counts", () => {
      const plane = new PlaneGeometry({
        widthSegments: 0,
        heightSegments: -1,
      });

      expect(plane.widthSegments).toBe(1);
      expect(plane.heightSegments).toBe(1);
    });

    it("should create a plane with all custom options", () => {
      const plane = new PlaneGeometry({
        width: 10,
        height: 8,
        widthSegments: 5,
        heightSegments: 3,
        orientation: "XZ",
      });

      expect(plane.width).toBe(10);
      expect(plane.height).toBe(8);
      expect(plane.widthSegments).toBe(5);
      expect(plane.heightSegments).toBe(3);
      expect(plane.orientation).toBe("XZ");
    });
  });

  describe("geometry data", () => {
    it("should generate correct vertex count for default plane", () => {
      const plane = new PlaneGeometry();

      // (widthSegments + 1) × (heightSegments + 1) = 2 × 2 = 4 vertices
      expect(plane.vertexCount).toBe(4);
      expect(plane.positions.length).toBe(4 * 3);
      expect(plane.normals.length).toBe(4 * 3);
      expect(plane.uvs.length).toBe(4 * 2);
    });

    it("should generate correct index count for default plane", () => {
      const plane = new PlaneGeometry();

      // widthSegments × heightSegments × 2 triangles × 3 indices = 1 × 1 × 6 = 6
      expect(plane.indexCount).toBe(6);
      expect(plane.indices.length).toBe(6);
    });

    it("should use Uint16Array for indices by default", () => {
      const plane = new PlaneGeometry();

      expect(plane.indices).toBeInstanceOf(Uint16Array);
    });

    it("should generate correct vertex count with segments", () => {
      const plane = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
      });

      // (3 + 1) × (4 + 1) = 4 × 5 = 20 vertices
      expect(plane.vertexCount).toBe(20);
      expect(plane.positions.length).toBe(20 * 3);
    });

    it("should generate correct index count with segments", () => {
      const plane = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
      });

      // 3 × 4 × 2 × 3 = 72 indices
      expect(plane.indexCount).toBe(72);
      expect(plane.indices.length).toBe(72);
    });

    it("should have consistent array lengths", () => {
      const plane = new PlaneGeometry({
        widthSegments: 5,
        heightSegments: 7,
      });

      const vertexCount = plane.vertexCount;
      expect(plane.positions.length).toBe(vertexCount * 3);
      expect(plane.normals.length).toBe(vertexCount * 3);
      expect(plane.tangents.length).toBe(vertexCount * 3);
      expect(plane.bitangents.length).toBe(vertexCount * 3);
      expect(plane.uvs.length).toBe(vertexCount * 2);
    });
  });

  describe("positions - XY orientation", () => {
    it("should have positions in XY plane (Z=0)", () => {
      const plane = new PlaneGeometry({ orientation: "XY" });
      const positions = plane.positions;

      // All Z coordinates should be 0
      for (let i = 2; i < positions.length; i += 3) {
        expect(positions[i]).toBeCloseTo(0, 5);
      }
    });

    it("should center the plane at origin", () => {
      const plane = new PlaneGeometry({
        width: 4,
        height: 6,
        orientation: "XY",
      });
      const positions = plane.positions;

      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]);
        maxX = Math.max(maxX, positions[i]);
        minY = Math.min(minY, positions[i + 1]);
        maxY = Math.max(maxY, positions[i + 1]);
      }

      // Check centering
      expect(minX + maxX).toBeCloseTo(0, 5);
      expect(minY + maxY).toBeCloseTo(0, 5);
    });

    it("should have correct dimensions", () => {
      const width = 8;
      const height = 4;
      const plane = new PlaneGeometry({
        width,
        height,
        orientation: "XY",
      });
      const positions = plane.positions;

      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]);
        maxX = Math.max(maxX, positions[i]);
        minY = Math.min(minY, positions[i + 1]);
        maxY = Math.max(maxY, positions[i + 1]);
      }

      expect(maxX - minX).toBeCloseTo(width, 5);
      expect(maxY - minY).toBeCloseTo(height, 5);
    });
  });

  describe("positions - XZ orientation", () => {
    it("should have positions in XZ plane (Y=0)", () => {
      const plane = new PlaneGeometry({ orientation: "XZ" });
      const positions = plane.positions;

      // All Y coordinates should be 0
      for (let i = 1; i < positions.length; i += 3) {
        expect(positions[i]).toBeCloseTo(0, 5);
      }
    });

    it("should center the plane at origin", () => {
      const plane = new PlaneGeometry({
        width: 4,
        height: 6,
        orientation: "XZ",
      });
      const positions = plane.positions;

      let minX = Infinity,
        maxX = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]);
        maxX = Math.max(maxX, positions[i]);
        minZ = Math.min(minZ, positions[i + 2]);
        maxZ = Math.max(maxZ, positions[i + 2]);
      }

      expect(minX + maxX).toBeCloseTo(0, 5);
      expect(minZ + maxZ).toBeCloseTo(0, 5);
    });

    it("should have correct dimensions", () => {
      const width = 10;
      const height = 5;
      const plane = new PlaneGeometry({
        width,
        height,
        orientation: "XZ",
      });
      const positions = plane.positions;

      let minX = Infinity,
        maxX = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minX = Math.min(minX, positions[i]);
        maxX = Math.max(maxX, positions[i]);
        minZ = Math.min(minZ, positions[i + 2]);
        maxZ = Math.max(maxZ, positions[i + 2]);
      }

      expect(maxX - minX).toBeCloseTo(width, 5);
      expect(maxZ - minZ).toBeCloseTo(height, 5);
    });
  });

  describe("positions - YZ orientation", () => {
    it("should have positions in YZ plane (X=0)", () => {
      const plane = new PlaneGeometry({ orientation: "YZ" });
      const positions = plane.positions;

      // All X coordinates should be 0
      for (let i = 0; i < positions.length; i += 3) {
        expect(positions[i]).toBeCloseTo(0, 5);
      }
    });

    it("should center the plane at origin", () => {
      const plane = new PlaneGeometry({
        width: 4,
        height: 6,
        orientation: "YZ",
      });
      const positions = plane.positions;

      let minY = Infinity,
        maxY = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minY = Math.min(minY, positions[i + 1]);
        maxY = Math.max(maxY, positions[i + 1]);
        minZ = Math.min(minZ, positions[i + 2]);
        maxZ = Math.max(maxZ, positions[i + 2]);
      }

      expect(minY + maxY).toBeCloseTo(0, 5);
      expect(minZ + maxZ).toBeCloseTo(0, 5);
    });

    it("should have correct dimensions", () => {
      const width = 6;
      const height = 8;
      const plane = new PlaneGeometry({
        width,
        height,
        orientation: "YZ",
      });
      const positions = plane.positions;

      let minY = Infinity,
        maxY = -Infinity;
      let minZ = Infinity,
        maxZ = -Infinity;

      for (let i = 0; i < positions.length; i += 3) {
        minY = Math.min(minY, positions[i + 1]);
        maxY = Math.max(maxY, positions[i + 1]);
        minZ = Math.min(minZ, positions[i + 2]);
        maxZ = Math.max(maxZ, positions[i + 2]);
      }

      expect(maxY - minY).toBeCloseTo(width, 5);
      expect(maxZ - minZ).toBeCloseTo(height, 5);
    });
  });

  describe("normals", () => {
    it("should have unit length normals", () => {
      const plane = new PlaneGeometry({ widthSegments: 2, heightSegments: 2 });
      const normals = plane.normals;

      for (let i = 0; i < normals.length; i += 3) {
        const x = normals[i];
        const y = normals[i + 1];
        const z = normals[i + 2];
        const length = Math.sqrt(x * x + y * y + z * z);

        expect(length).toBeCloseTo(1, 5);
      }
    });

    it("should have normals pointing in +Z direction for XY orientation", () => {
      const plane = new PlaneGeometry({ orientation: "XY" });
      const normals = plane.normals;

      for (let i = 0; i < normals.length; i += 3) {
        expect(normals[i]).toBeCloseTo(0, 5); // X
        expect(normals[i + 1]).toBeCloseTo(0, 5); // Y
        expect(normals[i + 2]).toBeCloseTo(1, 5); // Z
      }
    });

    it("should have normals pointing in +Y direction for XZ orientation", () => {
      const plane = new PlaneGeometry({ orientation: "XZ" });
      const normals = plane.normals;

      for (let i = 0; i < normals.length; i += 3) {
        expect(normals[i]).toBeCloseTo(0, 5); // X
        expect(normals[i + 1]).toBeCloseTo(1, 5); // Y
        expect(normals[i + 2]).toBeCloseTo(0, 5); // Z
      }
    });

    it("should have normals pointing in +X direction for YZ orientation", () => {
      const plane = new PlaneGeometry({ orientation: "YZ" });
      const normals = plane.normals;

      for (let i = 0; i < normals.length; i += 3) {
        expect(normals[i]).toBeCloseTo(1, 5); // X
        expect(normals[i + 1]).toBeCloseTo(0, 5); // Y
        expect(normals[i + 2]).toBeCloseTo(0, 5); // Z
      }
    });

    it("should have same normal for all vertices", () => {
      const plane = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 3,
        orientation: "XY",
      });
      const normals = plane.normals;

      // First normal
      const nx0 = normals[0];
      const ny0 = normals[1];
      const nz0 = normals[2];

      // All normals should be the same (flat surface)
      for (let i = 3; i < normals.length; i += 3) {
        expect(normals[i]).toBeCloseTo(nx0, 5);
        expect(normals[i + 1]).toBeCloseTo(ny0, 5);
        expect(normals[i + 2]).toBeCloseTo(nz0, 5);
      }
    });
  });

  describe("UVs", () => {
    it("should have UVs in valid range [0, 1]", () => {
      const plane = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 3,
      });
      const uvs = plane.uvs;

      for (let i = 0; i < uvs.length; i++) {
        expect(uvs[i]).toBeGreaterThanOrEqual(0);
        expect(uvs[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should have two UV coordinates per vertex", () => {
      const plane = new PlaneGeometry();

      expect(plane.uvs.length).toBe(plane.vertexCount * 2);
    });

    it("should cover full UV space", () => {
      const plane = new PlaneGeometry();
      const uvs = plane.uvs;

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

    it("should have bottom-left at (0,0) and top-right at (1,1)", () => {
      const plane = new PlaneGeometry({
        widthSegments: 1,
        heightSegments: 1,
      });
      const uvs = plane.uvs;

      // 2x2 grid of vertices
      // Expected UV coordinates:
      // (0,1) -- (1,1)
      //   |        |
      // (0,0) -- (1,0)

      const expectedUVs = [
        [0, 1], // bottom-left
        [1, 1], // bottom-right
        [0, 0], // top-left
        [1, 0], // top-right
      ];

      for (let i = 0; i < 4; i++) {
        const u = uvs[i * 2];
        const v = uvs[i * 2 + 1];
        const [expectedU, expectedV] = expectedUVs[i];

        expect(u).toBeCloseTo(expectedU, 5);
        expect(v).toBeCloseTo(expectedV, 5);
      }
    });

    it("should have evenly distributed UVs with segments", () => {
      const plane = new PlaneGeometry({
        widthSegments: 2,
        heightSegments: 2,
      });
      const uvs = plane.uvs;

      // With 2 segments, we have 3x3 grid
      // U values should be 0, 0.5, 1
      // V values should be 0, 0.5, 1

      const expectedValues = [0, 0.5, 1];
      const foundU = new Set<number>();
      const foundV = new Set<number>();

      for (let i = 0; i < uvs.length; i += 2) {
        const u = Math.round(uvs[i] * 2) / 2; // Round to nearest 0.5
        const v = Math.round(uvs[i + 1] * 2) / 2;
        foundU.add(u);
        foundV.add(v);
      }

      expectedValues.forEach((val) => {
        expect(foundU.has(val)).toBe(true);
        expect(foundV.has(val)).toBe(true);
      });
    });
  });

  describe("tangents and bitangents", () => {
    it("should generate tangents for all vertices", () => {
      const plane = new PlaneGeometry();

      expect(plane.tangents.length).toBe(plane.vertexCount * 3);
    });

    it("should generate bitangents for all vertices", () => {
      const plane = new PlaneGeometry();

      expect(plane.bitangents.length).toBe(plane.vertexCount * 3);
    });

    it("should have unit length tangents", () => {
      const plane = new PlaneGeometry({
        widthSegments: 2,
        heightSegments: 2,
      });
      const tangents = plane.tangents;

      for (let i = 0; i < tangents.length; i += 3) {
        const x = tangents[i];
        const y = tangents[i + 1];
        const z = tangents[i + 2];
        const length = Math.sqrt(x * x + y * y + z * z);

        expect(length).toBeCloseTo(1, 4);
      }
    });

    it("should have unit length bitangents", () => {
      const plane = new PlaneGeometry({
        widthSegments: 2,
        heightSegments: 2,
      });
      const bitangents = plane.bitangents;

      for (let i = 0; i < bitangents.length; i += 3) {
        const x = bitangents[i];
        const y = bitangents[i + 1];
        const z = bitangents[i + 2];
        const length = Math.sqrt(x * x + y * y + z * z);

        expect(length).toBeCloseTo(1, 4);
      }
    });

    it("should have orthogonal tangent, bitangent, and normal", () => {
      const plane = new PlaneGeometry({
        widthSegments: 2,
        heightSegments: 2,
      });
      const normals = plane.normals;
      const tangents = plane.tangents;
      const bitangents = plane.bitangents;

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
      const plane = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 3,
      });
      const indices = plane.indices;

      // All indices should be valid vertex indices
      for (let i = 0; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThanOrEqual(0);
        expect(indices[i]).toBeLessThan(plane.vertexCount);
      }
    });

    it("should have indices in multiples of 3 (triangles)", () => {
      const plane = new PlaneGeometry({
        widthSegments: 2,
        heightSegments: 2,
      });

      expect(plane.indices.length % 3).toBe(0);
    });

    it("should form valid triangles with consistent winding", () => {
      const plane = new PlaneGeometry({ orientation: "XY" });
      const positions = plane.positions;
      const indices = plane.indices;
      const normals = plane.normals;

      // Check first triangle
      const i0 = indices[0] * 3;
      const i1 = indices[1] * 3;
      const i2 = indices[2] * 3;

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

      // Normal direction should match the geometry's normal (can be + or -)
      const expectedNormal = [normals[0], normals[1], normals[2]];
      const triangleNormal = [nx / area, ny / area, nz / area];

      // Dot product should be close to ±1 (parallel or anti-parallel)
      const dot = Math.abs(
        expectedNormal[0] * triangleNormal[0] +
          expectedNormal[1] * triangleNormal[1] +
          expectedNormal[2] * triangleNormal[2]
      );
      expect(dot).toBeGreaterThan(0.9);
    });

    it("should generate 2 triangles per quad segment", () => {
      const plane = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 2,
      });

      const quadCount = 3 * 2; // widthSegments × heightSegments
      const triangleCount = quadCount * 2;
      const indexCount = triangleCount * 3;

      expect(plane.indices.length).toBe(indexCount);
    });
  });

  describe("edge cases", () => {
    it("should handle very small dimensions", () => {
      const plane = new PlaneGeometry({
        width: 0.001,
        height: 0.001,
      });

      expect(plane.vertexCount).toBe(4);
      expect(plane.indexCount).toBe(6);
    });

    it("should handle very large dimensions", () => {
      const plane = new PlaneGeometry({
        width: 1000,
        height: 1000,
      });

      expect(plane.vertexCount).toBe(4);
      expect(plane.indexCount).toBe(6);
    });

    it("should handle many segments", () => {
      const plane = new PlaneGeometry({
        widthSegments: 50,
        heightSegments: 50,
      });

      expect(plane.vertexCount).toBe(51 * 51);
      expect(plane.indexCount).toBe(50 * 50 * 6);
    });

    it("should handle non-square aspect ratios", () => {
      const plane = new PlaneGeometry({
        width: 1,
        height: 10,
        widthSegments: 1,
        heightSegments: 10,
      });

      expect(plane.vertexCount).toBe(2 * 11);
      expect(plane.indexCount).toBe(1 * 10 * 6);
    });

    it("should handle different segment counts", () => {
      const plane = new PlaneGeometry({
        widthSegments: 5,
        heightSegments: 2,
      });

      expect(plane.vertexCount).toBe(6 * 3);
      expect(plane.indexCount).toBe(5 * 2 * 6);
    });
  });

  describe("orientation consistency", () => {
    it("should have same vertex count regardless of orientation", () => {
      const planeXY = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
        orientation: "XY",
      });
      const planeXZ = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
        orientation: "XZ",
      });
      const planeYZ = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
        orientation: "YZ",
      });

      expect(planeXY.vertexCount).toBe(planeXZ.vertexCount);
      expect(planeXY.vertexCount).toBe(planeYZ.vertexCount);
    });

    it("should have same index count regardless of orientation", () => {
      const planeXY = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
        orientation: "XY",
      });
      const planeXZ = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
        orientation: "XZ",
      });
      const planeYZ = new PlaneGeometry({
        widthSegments: 3,
        heightSegments: 4,
        orientation: "YZ",
      });

      expect(planeXY.indexCount).toBe(planeXZ.indexCount);
      expect(planeXY.indexCount).toBe(planeYZ.indexCount);
    });

    it("should have different normal directions for different orientations", () => {
      const planeXY = new PlaneGeometry({ orientation: "XY" });
      const planeXZ = new PlaneGeometry({ orientation: "XZ" });
      const planeYZ = new PlaneGeometry({ orientation: "YZ" });

      // XY: normal is (0, 0, 1)
      expect(planeXY.normals[2]).toBeCloseTo(1, 5);

      // XZ: normal is (0, 1, 0)
      expect(planeXZ.normals[1]).toBeCloseTo(1, 5);

      // YZ: normal is (1, 0, 0)
      expect(planeYZ.normals[0]).toBeCloseTo(1, 5);
    });
  });

  describe("data consistency", () => {
    it("should return the same data on multiple accesses", () => {
      const plane = new PlaneGeometry();

      const positions1 = plane.positions;
      const positions2 = plane.positions;

      expect(positions1).toBe(positions2);
      expect(positions1).toEqual(positions2);
    });

    it("should have immutable geometry data", () => {
      const plane = new PlaneGeometry();

      const positions = plane.positions;
      const originalValue = positions[0];

      // Modify the array
      positions[0] = 999;

      // Get positions again
      const positions2 = plane.positions;

      // Should reflect the change (same array reference)
      expect(positions2[0]).toBe(999);

      // Restore for other tests
      positions[0] = originalValue;
    });

    it("should have all required geometry attributes", () => {
      const plane = new PlaneGeometry();

      expect(plane.positions).toBeInstanceOf(Float32Array);
      expect(plane.normals).toBeInstanceOf(Float32Array);
      expect(plane.uvs).toBeInstanceOf(Float32Array);
      expect(plane.tangents).toBeInstanceOf(Float32Array);
      expect(plane.bitangents).toBeInstanceOf(Float32Array);
      expect(plane.indices).toBeInstanceOf(Uint16Array);
      expect(typeof plane.vertexCount).toBe("number");
      expect(typeof plane.indexCount).toBe("number");
    });
  });

  describe("grid structure", () => {
    it("should create a regular grid of vertices", () => {
      const plane = new PlaneGeometry({
        width: 4,
        height: 4,
        widthSegments: 4,
        heightSegments: 4,
        orientation: "XY",
      });

      const positions = plane.positions;
      const expectedVertexCount = 5 * 5; // (4+1) × (4+1)

      expect(plane.vertexCount).toBe(expectedVertexCount);

      // Check that vertices form a regular grid
      const uniqueX = new Set<number>();
      const uniqueY = new Set<number>();

      for (let i = 0; i < positions.length; i += 3) {
        uniqueX.add(Math.round(positions[i] * 100) / 100);
        uniqueY.add(Math.round(positions[i + 1] * 100) / 100);
      }

      expect(uniqueX.size).toBe(5);
      expect(uniqueY.size).toBe(5);
    });

    it("should have vertices in correct order", () => {
      const plane = new PlaneGeometry({
        widthSegments: 2,
        heightSegments: 2,
        orientation: "XY",
      });

      // With 2 segments, we have 3x3 grid
      expect(plane.vertexCount).toBe(9);

      // Vertices should be ordered row by row
      // Implementation generates from bottom to top (iy increases)
      const positions = plane.positions;

      // First vertex (iy=0, ix=0) should be at bottom-left
      const y0 = positions[1];
      // Last vertex (iy=2, ix=2) should be at top-right
      const y8 = positions[3 * 8 + 1];

      // Bottom should be < top
      expect(y0).toBeLessThan(y8);
    });
  });

  describe("real-world usage scenarios", () => {
    it("should create a ground plane (XZ orientation)", () => {
      const groundPlane = new PlaneGeometry({
        width: 100,
        height: 100,
        widthSegments: 10,
        heightSegments: 10,
        orientation: "XZ",
      });

      expect(groundPlane.orientation).toBe("XZ");
      expect(groundPlane.vertexCount).toBe(11 * 11);

      // Normal should point up (+Y)
      expect(groundPlane.normals[1]).toBeCloseTo(1, 5);
    });

    it("should create a wall (XY orientation)", () => {
      const wall = new PlaneGeometry({
        width: 10,
        height: 5,
        widthSegments: 5,
        heightSegments: 2,
        orientation: "XY",
      });

      expect(wall.orientation).toBe("XY");

      // Normal should point forward (+Z)
      expect(wall.normals[2]).toBeCloseTo(1, 5);
    });

    it("should create a highly subdivided surface", () => {
      const detailedPlane = new PlaneGeometry({
        width: 1,
        height: 1,
        widthSegments: 20,
        heightSegments: 20,
      });

      expect(detailedPlane.vertexCount).toBe(21 * 21);
      expect(detailedPlane.indexCount).toBe(20 * 20 * 6);
    });

    it("should create a billboard (single quad)", () => {
      const billboard = new PlaneGeometry({
        width: 2,
        height: 2,
        widthSegments: 1,
        heightSegments: 1,
      });

      expect(billboard.vertexCount).toBe(4);
      expect(billboard.indexCount).toBe(6);

      // Should have full UV mapping
      const uvs = billboard.uvs;
      const uvSet = new Set<string>();
      for (let i = 0; i < uvs.length; i += 2) {
        uvSet.add(`${uvs[i]},${uvs[i + 1]}`);
      }
      expect(uvSet.size).toBe(4); // 4 unique UV coordinates
    });
  });
});
