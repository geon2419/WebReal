import { describe, it, expect } from "bun:test";
import { CylinderGeometry } from "./CylinderGeometry";

describe("CylinderGeometry", () => {
  it("should clamp segment values (min + floor)", () => {
    const cylinder = new CylinderGeometry({
      radialSegments: 1.2,
      heightSegments: 0.1,
    });
    expect(cylinder.radialSegments).toBe(3);
    expect(cylinder.heightSegments).toBe(1);

    const floored = new CylinderGeometry({
      radialSegments: 15.7,
      heightSegments: 3.9,
    });
    expect(floored.radialSegments).toBe(15);
    expect(floored.heightSegments).toBe(3);
  });

  it("should generate valid buffers (closed vs openEnded)", () => {
    const closed = new CylinderGeometry({
      radialSegments: 8,
      heightSegments: 2,
      openEnded: false,
    });
    const open = new CylinderGeometry({
      radialSegments: 8,
      heightSegments: 2,
      openEnded: true,
    });

    expect(closed.vertexCount).toBeGreaterThan(0);
    expect(closed.indexCount).toBeGreaterThan(0);
    expect(open.vertexCount).toBeGreaterThan(0);
    expect(open.indexCount).toBeGreaterThan(0);

    // Caps removed when openEnded is true.
    expect(open.vertexCount).toBeLessThan(closed.vertexCount);

    expect(closed.positions.length).toBe(closed.vertexCount * 3);
    expect(closed.normals.length).toBe(closed.vertexCount * 3);
    expect(closed.uvs.length).toBe(closed.vertexCount * 2);
    expect(closed.tangents.length).toBe(closed.vertexCount * 3);
    expect(closed.bitangents.length).toBe(closed.vertexCount * 3);
    expect(closed.indices.length).toBe(closed.indexCount);

    for (let i = 0; i < closed.positions.length; i++) {
      expect(Number.isFinite(closed.positions[i])).toBe(true);
    }
  });

  it("should produce in-range indices and normalized normals", () => {
    const cylinder = new CylinderGeometry({
      radialSegments: 12,
      heightSegments: 3,
    });

    for (let i = 0; i < cylinder.indices.length; i++) {
      expect(cylinder.indices[i]).toBeGreaterThanOrEqual(0);
      expect(cylinder.indices[i]).toBeLessThan(cylinder.vertexCount);
    }

    // Sample a few normals.
    const sampleVertexIndices = [
      0,
      Math.floor(cylinder.vertexCount / 2),
      cylinder.vertexCount - 1,
    ];
    for (const vertexIndex of sampleVertexIndices) {
      const nBase = vertexIndex * 3;
      const nx = cylinder.normals[nBase];
      const ny = cylinder.normals[nBase + 1];
      const nz = cylinder.normals[nBase + 2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(len).toBeCloseTo(1, 4);
    }
  });
});
