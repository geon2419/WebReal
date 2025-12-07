import { describe, it, expect } from "vitest";
import { SphereGeometry } from "./SphereGeometry";

describe("SphereGeometry", () => {
  describe("constructor", () => {
    it("should create a sphere with default parameters", () => {
      const sphere = new SphereGeometry();

      expect(sphere.radius).toBe(1);
      expect(sphere.widthSegments).toBe(32);
      expect(sphere.heightSegments).toBe(16);
      expect(sphere.phiStart).toBe(0);
      expect(sphere.phiLength).toBe(Math.PI * 2);
      expect(sphere.thetaStart).toBe(0);
      expect(sphere.thetaLength).toBe(Math.PI);
    });

    it("should create a sphere with custom parameters", () => {
      const sphere = new SphereGeometry({
        radius: 2,
        widthSegments: 16,
        heightSegments: 8,
        phiStart: Math.PI / 4,
        phiLength: Math.PI,
        thetaStart: Math.PI / 6,
        thetaLength: Math.PI / 2,
      });

      expect(sphere.radius).toBe(2);
      expect(sphere.widthSegments).toBe(16);
      expect(sphere.heightSegments).toBe(8);
      expect(sphere.phiStart).toBe(Math.PI / 4);
      expect(sphere.phiLength).toBe(Math.PI);
      expect(sphere.thetaStart).toBe(Math.PI / 6);
      expect(sphere.thetaLength).toBe(Math.PI / 2);
    });

    it("should enforce minimum segment counts", () => {
      const sphere = new SphereGeometry({
        widthSegments: 1,
        heightSegments: 1,
      });

      expect(sphere.widthSegments).toBe(3);
      expect(sphere.heightSegments).toBe(2);
    });

    it("should floor segment values", () => {
      const sphere = new SphereGeometry({
        widthSegments: 15.7,
        heightSegments: 10.3,
      });

      expect(sphere.widthSegments).toBe(15);
      expect(sphere.heightSegments).toBe(10);
    });
  });

  describe("geometry data", () => {
    it("should generate correct vertex count", () => {
      const sphere = new SphereGeometry({
        widthSegments: 8,
        heightSegments: 4,
      });

      // (widthSegments + 1) * (heightSegments + 1)
      const expectedVertexCount = (8 + 1) * (4 + 1);
      expect(sphere.vertexCount).toBe(expectedVertexCount);
      expect(sphere.positions.length).toBe(expectedVertexCount * 3);
      expect(sphere.normals.length).toBe(expectedVertexCount * 3);
      expect(sphere.uvs.length).toBe(expectedVertexCount * 2);
    });

    it("should generate valid indices", () => {
      const sphere = new SphereGeometry({
        widthSegments: 8,
        heightSegments: 4,
      });

      // All indices should be within valid range
      for (let i = 0; i < sphere.indexCount; i++) {
        expect(sphere.indices[i]).toBeGreaterThanOrEqual(0);
        expect(sphere.indices[i]).toBeLessThan(sphere.vertexCount);
      }

      // Index count should be divisible by 3 (triangles)
      expect(sphere.indexCount % 3).toBe(0);
    });

    it("should generate normalized normals", () => {
      const sphere = new SphereGeometry({
        widthSegments: 8,
        heightSegments: 4,
      });

      // Check that normals are normalized (length ≈ 1)
      for (let i = 0; i < sphere.vertexCount; i++) {
        const nx = sphere.normals[i * 3];
        const ny = sphere.normals[i * 3 + 1];
        const nz = sphere.normals[i * 3 + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

        expect(length).toBeCloseTo(1, 5);
      }
    });

    it("should generate UVs in valid range", () => {
      const sphere = new SphereGeometry({
        widthSegments: 8,
        heightSegments: 4,
      });

      // UVs should be in [0, 1] range (with small tolerance for pole offset)
      for (let i = 0; i < sphere.vertexCount; i++) {
        const u = sphere.uvs[i * 2];
        const v = sphere.uvs[i * 2 + 1];

        expect(u).toBeGreaterThanOrEqual(-0.1);
        expect(u).toBeLessThanOrEqual(1.1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });

    it("should generate tangents and bitangents", () => {
      const sphere = new SphereGeometry({
        widthSegments: 8,
        heightSegments: 4,
      });

      expect(sphere.tangents).toBeDefined();
      expect(sphere.bitangents).toBeDefined();
      expect(sphere.tangents.length).toBe(sphere.vertexCount * 3);
      expect(sphere.bitangents.length).toBe(sphere.vertexCount * 3);
    });
  });

  describe("partial spheres", () => {
    it("should create a hemisphere with thetaLength", () => {
      const hemisphere = new SphereGeometry({
        radius: 1,
        widthSegments: 8,
        heightSegments: 4,
        thetaLength: Math.PI / 2,
      });

      expect(hemisphere.thetaLength).toBe(Math.PI / 2);
      expect(hemisphere.vertexCount).toBeGreaterThan(0);
      expect(hemisphere.indexCount).toBeGreaterThan(0);
    });

    it("should create a partial sphere with phi parameters", () => {
      const partialSphere = new SphereGeometry({
        radius: 1,
        widthSegments: 8,
        heightSegments: 4,
        phiStart: Math.PI / 4,
        phiLength: Math.PI,
      });

      expect(partialSphere.phiStart).toBe(Math.PI / 4);
      expect(partialSphere.phiLength).toBe(Math.PI);
      expect(partialSphere.vertexCount).toBeGreaterThan(0);
      expect(partialSphere.indexCount).toBeGreaterThan(0);
    });

    it("should create a partial sphere with theta parameters", () => {
      const partialSphere = new SphereGeometry({
        radius: 1,
        widthSegments: 8,
        heightSegments: 4,
        thetaStart: Math.PI / 6,
        thetaLength: Math.PI / 3,
      });

      expect(partialSphere.thetaStart).toBe(Math.PI / 6);
      expect(partialSphere.thetaLength).toBe(Math.PI / 3);
      expect(partialSphere.vertexCount).toBeGreaterThan(0);
      expect(partialSphere.indexCount).toBeGreaterThan(0);
    });
  });

  describe("positions at radius", () => {
    it("should have all vertices at correct radius distance", () => {
      const radius = 2.5;
      const sphere = new SphereGeometry({
        radius,
        widthSegments: 8,
        heightSegments: 4,
      });

      // Check that all vertices are at the correct radius distance from origin
      for (let i = 0; i < sphere.vertexCount; i++) {
        const x = sphere.positions[i * 3];
        const y = sphere.positions[i * 3 + 1];
        const z = sphere.positions[i * 3 + 2];
        const distance = Math.sqrt(x * x + y * y + z * z);

        expect(distance).toBeCloseTo(radius, 5);
      }
    });
  });

  describe("normals point outward", () => {
    it("should have normals pointing away from origin", () => {
      const sphere = new SphereGeometry({
        radius: 1,
        widthSegments: 8,
        heightSegments: 4,
      });

      // Normals should point in the same direction as position vectors
      // (dot product of normalized position and normal should be ≈ 1)
      for (let i = 0; i < sphere.vertexCount; i++) {
        const px = sphere.positions[i * 3];
        const py = sphere.positions[i * 3 + 1];
        const pz = sphere.positions[i * 3 + 2];
        const pLength = Math.sqrt(px * px + py * py + pz * pz);

        const nx = sphere.normals[i * 3];
        const ny = sphere.normals[i * 3 + 1];
        const nz = sphere.normals[i * 3 + 2];

        // Dot product of normalized position and normal
        const dot =
          (px / pLength) * nx + (py / pLength) * ny + (pz / pLength) * nz;

        expect(dot).toBeCloseTo(1, 5);
      }
    });
  });
});
