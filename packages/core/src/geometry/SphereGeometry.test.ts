import { describe, it, expect } from "bun:test";
import { SphereGeometry } from "./SphereGeometry";

describe("SphereGeometry", () => {
  it("should clamp segment values (min + floor)", () => {
    const sphere = new SphereGeometry({
      widthSegments: 1.9,
      heightSegments: 1.2,
    });
    expect(sphere.widthSegments).toBe(3);
    expect(sphere.heightSegments).toBe(2);

    const floored = new SphereGeometry({
      widthSegments: 15.7,
      heightSegments: 10.3,
    });
    expect(floored.widthSegments).toBe(15);
    expect(floored.heightSegments).toBe(10);
  });

  it("should generate indexed buffers with correct sizes and valid indices", () => {
    const widthSegments = 8;
    const heightSegments = 4;
    const sphere = new SphereGeometry({ widthSegments, heightSegments });

    const expectedVertexCount = (widthSegments + 1) * (heightSegments + 1);
    expect(sphere.vertexCount).toBe(expectedVertexCount);
    expect(sphere.positions.length).toBe(expectedVertexCount * 3);
    expect(sphere.normals.length).toBe(expectedVertexCount * 3);
    expect(sphere.uvs.length).toBe(expectedVertexCount * 2);
    expect(sphere.tangents.length).toBe(expectedVertexCount * 3);
    expect(sphere.bitangents.length).toBe(expectedVertexCount * 3);
    expect(sphere.indices.length).toBe(sphere.indexCount);

    for (let i = 0; i < sphere.indices.length; i++) {
      expect(sphere.indices[i]).toBeGreaterThanOrEqual(0);
      expect(sphere.indices[i]).toBeLessThan(sphere.vertexCount);
    }
  });

  it("should place vertices near radius and normals outward", () => {
    const radius = 2.5;
    const sphere = new SphereGeometry({
      radius,
      widthSegments: 16,
      heightSegments: 8,
    });

    // Sample a few vertices (avoid poles where UV tweaks can be special-cased).
    const sampleVertexIndices = [10, 50, 100, sphere.vertexCount - 20];
    for (const vertexIndex of sampleVertexIndices) {
      const pBase = vertexIndex * 3;
      const x = sphere.positions[pBase];
      const y = sphere.positions[pBase + 1];
      const z = sphere.positions[pBase + 2];
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeCloseTo(radius, 4);

      const nx = sphere.normals[pBase];
      const ny = sphere.normals[pBase + 1];
      const nz = sphere.normals[pBase + 2];
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(nLen).toBeCloseTo(1, 4);

      // Normal should generally align with position direction.
      const dot = (x / dist) * nx + (y / dist) * ny + (z / dist) * nz;
      expect(dot).toBeGreaterThan(0.9);
    }

    // UVs should be within expected range.
    for (let i = 0; i < sphere.uvs.length; i += 2) {
      const u = sphere.uvs[i];
      const v = sphere.uvs[i + 1];
      expect(u).toBeGreaterThanOrEqual(-0.1);
      expect(u).toBeLessThanOrEqual(1.1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
