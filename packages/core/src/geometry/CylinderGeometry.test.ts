import { describe, it, expect } from "vitest";
import { CylinderGeometry } from "./CylinderGeometry";

describe("CylinderGeometry", () => {
  describe("constructor", () => {
    it("should create a cylinder with default parameters", () => {
      const cylinder = new CylinderGeometry();

      expect(cylinder.radiusTop).toBe(1);
      expect(cylinder.radiusBottom).toBe(1);
      expect(cylinder.height).toBe(1);
      expect(cylinder.radialSegments).toBe(32);
      expect(cylinder.heightSegments).toBe(1);
      expect(cylinder.openEnded).toBe(false);
      expect(cylinder.thetaStart).toBe(0);
      expect(cylinder.thetaLength).toBe(Math.PI * 2);
    });

    it("should create a cylinder with custom parameters", () => {
      const cylinder = new CylinderGeometry({
        radiusTop: 2,
        radiusBottom: 3,
        height: 5,
        radialSegments: 16,
        heightSegments: 3,
        openEnded: true,
        thetaStart: Math.PI / 4,
        thetaLength: Math.PI,
      });

      expect(cylinder.radiusTop).toBe(2);
      expect(cylinder.radiusBottom).toBe(3);
      expect(cylinder.height).toBe(5);
      expect(cylinder.radialSegments).toBe(16);
      expect(cylinder.heightSegments).toBe(3);
      expect(cylinder.openEnded).toBe(true);
      expect(cylinder.thetaStart).toBe(Math.PI / 4);
      expect(cylinder.thetaLength).toBe(Math.PI);
    });

    it("should enforce minimum segment counts", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 1,
        heightSegments: 0,
      });

      expect(cylinder.radialSegments).toBe(3);
      expect(cylinder.heightSegments).toBe(1);
    });

    it("should floor segment values", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 15.7,
        heightSegments: 3.9,
      });

      expect(cylinder.radialSegments).toBe(15);
      expect(cylinder.heightSegments).toBe(3);
    });
  });

  describe("geometry data", () => {
    it("should generate correct vertex count for closed cylinder", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 8,
        heightSegments: 2,
        openEnded: false,
      });

      // Body: (radialSegments + 1) * (heightSegments + 1)
      // Top cap: 1 center + (radialSegments + 1) ring = radialSegments + 2
      // Bottom cap: 1 center + (radialSegments + 1) ring = radialSegments + 2
      const bodyVertices = (8 + 1) * (2 + 1);
      const topCapVertices = 8 + 2;
      const bottomCapVertices = 8 + 2;
      const expectedVertexCount =
        bodyVertices + topCapVertices + bottomCapVertices;

      expect(cylinder.vertexCount).toBe(expectedVertexCount);
      expect(cylinder.positions.length).toBe(expectedVertexCount * 3);
      expect(cylinder.normals.length).toBe(expectedVertexCount * 3);
      expect(cylinder.uvs.length).toBe(expectedVertexCount * 2);
    });

    it("should generate correct vertex count for open cylinder", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 8,
        heightSegments: 2,
        openEnded: true,
      });

      // Body only: (radialSegments + 1) * (heightSegments + 1)
      const expectedVertexCount = (8 + 1) * (2 + 1);

      expect(cylinder.vertexCount).toBe(expectedVertexCount);
    });

    it("should generate valid indices", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 8,
        heightSegments: 2,
      });

      // All indices should be within valid range
      for (let i = 0; i < cylinder.indexCount; i++) {
        expect(cylinder.indices[i]).toBeGreaterThanOrEqual(0);
        expect(cylinder.indices[i]).toBeLessThan(cylinder.vertexCount);
      }

      // Index count should be divisible by 3 (triangles)
      expect(cylinder.indexCount % 3).toBe(0);
    });

    it("should generate normalized normals", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 8,
        heightSegments: 2,
      });

      // Check that normals are normalized (length ≈ 1)
      for (let i = 0; i < cylinder.vertexCount; i++) {
        const nx = cylinder.normals[i * 3];
        const ny = cylinder.normals[i * 3 + 1];
        const nz = cylinder.normals[i * 3 + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

        expect(length).toBeCloseTo(1, 5);
      }
    });

    it("should generate UVs in valid range", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 8,
        heightSegments: 2,
      });

      // UVs should be in [0, 1] range
      for (let i = 0; i < cylinder.vertexCount; i++) {
        const u = cylinder.uvs[i * 2];
        const v = cylinder.uvs[i * 2 + 1];

        expect(u).toBeGreaterThanOrEqual(-0.1);
        expect(u).toBeLessThanOrEqual(1.1);
        expect(v).toBeGreaterThanOrEqual(-0.1);
        expect(v).toBeLessThanOrEqual(1.1);
      }
    });

    it("should generate tangents and bitangents", () => {
      const cylinder = new CylinderGeometry({
        radialSegments: 8,
        heightSegments: 2,
      });

      expect(cylinder.tangents).toBeDefined();
      expect(cylinder.bitangents).toBeDefined();
      expect(cylinder.tangents.length).toBe(cylinder.vertexCount * 3);
      expect(cylinder.bitangents.length).toBe(cylinder.vertexCount * 3);
    });
  });

  describe("cone geometry", () => {
    it("should create a cone with radiusTop = 0", () => {
      const cone = new CylinderGeometry({
        radiusTop: 0,
        radiusBottom: 1,
        height: 2,
        radialSegments: 8,
        heightSegments: 2,
        openEnded: false,
      });

      expect(cone.radiusTop).toBe(0);
      expect(cone.radiusBottom).toBe(1);
      expect(cone.vertexCount).toBeGreaterThan(0);
      expect(cone.indexCount).toBeGreaterThan(0);

      // Should not generate top cap (radius is 0)
      // Body + bottom cap only
      const bodyVertices = (8 + 1) * (2 + 1);
      const bottomCapVertices = 8 + 2;
      expect(cone.vertexCount).toBe(bodyVertices + bottomCapVertices);
    });

    it("should create an inverted cone with radiusBottom = 0", () => {
      const cone = new CylinderGeometry({
        radiusTop: 1,
        radiusBottom: 0,
        height: 2,
        radialSegments: 8,
        heightSegments: 2,
        openEnded: false,
      });

      expect(cone.radiusTop).toBe(1);
      expect(cone.radiusBottom).toBe(0);

      // Body + top cap only
      const bodyVertices = (8 + 1) * (2 + 1);
      const topCapVertices = 8 + 2;
      expect(cone.vertexCount).toBe(bodyVertices + topCapVertices);
    });

    it("should create a truncated cone", () => {
      const truncatedCone = new CylinderGeometry({
        radiusTop: 0.5,
        radiusBottom: 1.5,
        height: 3,
        radialSegments: 8,
        heightSegments: 2,
      });

      expect(truncatedCone.radiusTop).toBe(0.5);
      expect(truncatedCone.radiusBottom).toBe(1.5);

      // Should have both caps
      const bodyVertices = (8 + 1) * (2 + 1);
      const topCapVertices = 8 + 2;
      const bottomCapVertices = 8 + 2;
      expect(truncatedCone.vertexCount).toBe(
        bodyVertices + topCapVertices + bottomCapVertices
      );
    });
  });

  describe("partial cylinders", () => {
    it("should create a half cylinder with thetaLength", () => {
      const halfCylinder = new CylinderGeometry({
        radiusTop: 1,
        radiusBottom: 1,
        height: 2,
        radialSegments: 8,
        heightSegments: 2,
        thetaLength: Math.PI,
      });

      expect(halfCylinder.thetaLength).toBe(Math.PI);
      expect(halfCylinder.vertexCount).toBeGreaterThan(0);
      expect(halfCylinder.indexCount).toBeGreaterThan(0);
    });

    it("should create a partial cylinder with theta start and length", () => {
      const partialCylinder = new CylinderGeometry({
        radiusTop: 1,
        radiusBottom: 1,
        height: 2,
        radialSegments: 8,
        heightSegments: 2,
        thetaStart: Math.PI / 4,
        thetaLength: Math.PI / 2,
      });

      expect(partialCylinder.thetaStart).toBe(Math.PI / 4);
      expect(partialCylinder.thetaLength).toBe(Math.PI / 2);
      expect(partialCylinder.vertexCount).toBeGreaterThan(0);
      expect(partialCylinder.indexCount).toBeGreaterThan(0);
    });
  });

  describe("body vertices position", () => {
    it("should have body vertices at correct radii for standard cylinder", () => {
      const radius = 2;
      const cylinder = new CylinderGeometry({
        radiusTop: radius,
        radiusBottom: radius,
        height: 4,
        radialSegments: 8,
        heightSegments: 2,
        openEnded: true, // Only check body vertices
      });

      const bodyVertexCount = (8 + 1) * (2 + 1);

      // Check first few and last few vertices are at correct radius
      for (let i = 0; i < bodyVertexCount; i++) {
        const x = cylinder.positions[i * 3];
        const z = cylinder.positions[i * 3 + 2];

        // Calculate distance from Y-axis (radius in XZ plane)
        const distanceFromYAxis = Math.sqrt(x * x + z * z);

        expect(distanceFromYAxis).toBeCloseTo(radius, 5);
      }
    });

    it("should interpolate radius correctly for cone", () => {
      const radiusTop = 1;
      const radiusBottom = 2;
      const height = 3;
      const cylinder = new CylinderGeometry({
        radiusTop,
        radiusBottom,
        height,
        radialSegments: 8,
        heightSegments: 2,
        openEnded: true,
      });

      // Check vertices at different heights have interpolated radii
      const heightLevels = 3; // heightSegments + 1

      for (let level = 0; level < heightLevels; level++) {
        const v = level / (heightLevels - 1);
        const expectedRadius = v * (radiusBottom - radiusTop) + radiusTop;

        // Check one vertex at this height level
        const vertexIndex = level * (8 + 1);
        const x = cylinder.positions[vertexIndex * 3];
        const z = cylinder.positions[vertexIndex * 3 + 2];
        const actualRadius = Math.sqrt(x * x + z * z);

        expect(actualRadius).toBeCloseTo(expectedRadius, 5);
      }
    });

    it("should have vertices within correct height range", () => {
      const height = 5;
      const cylinder = new CylinderGeometry({
        radiusTop: 1,
        radiusBottom: 1,
        height,
        radialSegments: 8,
        heightSegments: 3,
        openEnded: true,
      });

      const bodyVertexCount = (8 + 1) * (3 + 1);

      // Check all body vertices are within height range
      for (let i = 0; i < bodyVertexCount; i++) {
        const y = cylinder.positions[i * 3 + 1];

        expect(y).toBeGreaterThanOrEqual(-height / 2 - 0.001);
        expect(y).toBeLessThanOrEqual(height / 2 + 0.001);
      }
    });
  });

  describe("cap normals", () => {
    it("should have top cap normals pointing up", () => {
      const cylinder = new CylinderGeometry({
        radiusTop: 1,
        radiusBottom: 1,
        height: 2,
        radialSegments: 8,
        heightSegments: 1,
        openEnded: false,
      });

      // Body vertices: (8 + 1) * (1 + 1) = 18
      // Top cap starts at index 18, has 8 + 2 = 10 vertices
      const bodyVertexCount = (8 + 1) * (1 + 1);
      const topCapStart = bodyVertexCount;
      const topCapEnd = topCapStart + (8 + 2);

      for (let i = topCapStart; i < topCapEnd; i++) {
        const ny = cylinder.normals[i * 3 + 1];
        expect(ny).toBeCloseTo(1, 5);
      }
    });

    it("should have bottom cap normals pointing down", () => {
      const cylinder = new CylinderGeometry({
        radiusTop: 1,
        radiusBottom: 1,
        height: 2,
        radialSegments: 8,
        heightSegments: 1,
        openEnded: false,
      });

      // Body vertices: (8 + 1) * (1 + 1) = 18
      // Top cap vertices: 8 + 2 = 10
      // Bottom cap starts at index 28, has 8 + 2 = 10 vertices
      const bodyVertexCount = (8 + 1) * (1 + 1);
      const topCapVertexCount = 8 + 2;
      const bottomCapStart = bodyVertexCount + topCapVertexCount;
      const bottomCapEnd = bottomCapStart + (8 + 2);

      for (let i = bottomCapStart; i < bottomCapEnd; i++) {
        const ny = cylinder.normals[i * 3 + 1];
        expect(ny).toBeCloseTo(-1, 5);
      }
    });
  });
});
