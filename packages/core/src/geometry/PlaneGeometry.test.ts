import { describe, it, expect } from "bun:test";
import { PlaneGeometry } from "./PlaneGeometry";

describe("PlaneGeometry", () => {
  it("should enforce minimum segment counts", () => {
    const plane = new PlaneGeometry({ widthSegments: 0, heightSegments: -1 });
    expect(plane.widthSegments).toBe(1);
    expect(plane.heightSegments).toBe(1);
  });

  it("should generate indexed triangle buffers with correct sizes", () => {
    const widthSegments = 3;
    const heightSegments = 4;
    const plane = new PlaneGeometry({ widthSegments, heightSegments });

    const expectedVertexCount = (widthSegments + 1) * (heightSegments + 1);
    const expectedIndexCount = widthSegments * heightSegments * 2 * 3;

    expect(plane.positions).toBeInstanceOf(Float32Array);
    expect(plane.normals).toBeInstanceOf(Float32Array);
    expect(plane.uvs).toBeInstanceOf(Float32Array);

    expect(plane.vertexCount).toBe(expectedVertexCount);
    expect(plane.indexCount).toBe(expectedIndexCount);
    expect(plane.positions.length).toBe(expectedVertexCount * 3);
    expect(plane.normals.length).toBe(expectedVertexCount * 3);
    expect(plane.uvs.length).toBe(expectedVertexCount * 2);
    expect(plane.indices.length).toBe(expectedIndexCount);

    for (let i = 0; i < plane.positions.length; i++) {
      expect(Number.isFinite(plane.positions[i])).toBe(true);
    }
  });

  it("should orient positions and normals correctly per orientation", () => {
    const planeXY = new PlaneGeometry({ orientation: "XY" });
    const planeXZ = new PlaneGeometry({ orientation: "XZ" });
    const planeYZ = new PlaneGeometry({ orientation: "YZ" });

    // XY: z=0, normal +Z
    expect(planeXY.positions[2]).toBeCloseTo(0, 6);
    expect(planeXY.normals[0]).toBeCloseTo(0, 6);
    expect(planeXY.normals[1]).toBeCloseTo(0, 6);
    expect(planeXY.normals[2]).toBeCloseTo(1, 6);

    // XZ: y=0, normal +Y
    expect(planeXZ.positions[1]).toBeCloseTo(0, 6);
    expect(planeXZ.normals[0]).toBeCloseTo(0, 6);
    expect(planeXZ.normals[1]).toBeCloseTo(1, 6);
    expect(planeXZ.normals[2]).toBeCloseTo(0, 6);

    // YZ: x=0, normal +X
    expect(planeYZ.positions[0]).toBeCloseTo(0, 6);
    expect(planeYZ.normals[0]).toBeCloseTo(1, 6);
    expect(planeYZ.normals[1]).toBeCloseTo(0, 6);
    expect(planeYZ.normals[2]).toBeCloseTo(0, 6);
  });

  it("should have UVs in [0, 1] and valid indices", () => {
    const plane = new PlaneGeometry({ widthSegments: 2, heightSegments: 2 });

    for (let i = 0; i < plane.uvs.length; i++) {
      expect(plane.uvs[i]).toBeGreaterThanOrEqual(0);
      expect(plane.uvs[i]).toBeLessThanOrEqual(1);
    }

    for (let i = 0; i < plane.indices.length; i++) {
      expect(plane.indices[i]).toBeGreaterThanOrEqual(0);
      expect(plane.indices[i]).toBeLessThan(plane.vertexCount);
    }

    // First triangle should be non-degenerate.
    const indices = plane.indices;
    const p = plane.positions;
    const i0 = indices[0] * 3;
    const i1 = indices[1] * 3;
    const i2 = indices[2] * 3;
    const v0 = [p[i0], p[i0 + 1], p[i0 + 2]];
    const v1 = [p[i1], p[i1 + 1], p[i1 + 2]];
    const v2 = [p[i2], p[i2 + 1], p[i2 + 2]];
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    const area2 = Math.sqrt(cx * cx + cy * cy + cz * cz);
    expect(area2).toBeGreaterThan(0);
  });
});
