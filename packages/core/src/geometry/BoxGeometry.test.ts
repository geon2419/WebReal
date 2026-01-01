import { describe, it, expect } from "bun:test";
import { BoxGeometry } from "./BoxGeometry";

function expectFinite(values: ArrayLike<number>): void {
  for (let i = 0; i < values.length; i++) {
    expect(Number.isFinite(values[i])).toBe(true);
  }
}

describe("BoxGeometry", () => {
  it("should generate WebGPU-ready buffers for default box", () => {
    const box = new BoxGeometry();

    expect(box.vertexCount).toBe(24);
    expect(box.indexCount).toBe(36);

    expect(box.positions).toBeInstanceOf(Float32Array);
    expect(box.normals).toBeInstanceOf(Float32Array);
    expect(box.uvs).toBeInstanceOf(Float32Array);
    expect(box.tangents).toBeInstanceOf(Float32Array);
    expect(box.bitangents).toBeInstanceOf(Float32Array);
    expect(box.indices).toBeInstanceOf(Uint16Array);

    expect(box.positions.length).toBe(box.vertexCount * 3);
    expect(box.normals.length).toBe(box.vertexCount * 3);
    expect(box.uvs.length).toBe(box.vertexCount * 2);
    expect(box.tangents.length).toBe(box.vertexCount * 3);
    expect(box.bitangents.length).toBe(box.vertexCount * 3);
    expect(box.indices.length).toBe(box.indexCount);

    expectFinite(box.positions);
    expectFinite(box.normals);
    expectFinite(box.uvs);
    expectFinite(box.tangents);
    expectFinite(box.bitangents);
  });

  it("should be centered and bounded by dimensions", () => {
    const width = 4;
    const height = 6;
    const depth = 8;
    const box = new BoxGeometry(width, height, depth);
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

    expect(maxX - minX).toBeCloseTo(width, 5);
    expect(maxY - minY).toBeCloseTo(height, 5);
    expect(maxZ - minZ).toBeCloseTo(depth, 5);
    expect(minX + maxX).toBeCloseTo(0, 5);
    expect(minY + maxY).toBeCloseTo(0, 5);
    expect(minZ + maxZ).toBeCloseTo(0, 5);
  });

  it("should produce valid normals/UVs and non-degenerate triangles", () => {
    const box = new BoxGeometry(2, 2, 2);

    // Sample a few vertices rather than all.
    const sampleVertexIndices = [0, 5, 12, 23];
    for (const vertexIndex of sampleVertexIndices) {
      const nBase = vertexIndex * 3;
      const nx = box.normals[nBase];
      const ny = box.normals[nBase + 1];
      const nz = box.normals[nBase + 2];
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
      expect(nLen).toBeCloseTo(1, 5);

      // Axis-aligned normals: exactly one axis should be non-zero.
      const abs = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
      const nonZeroCount = abs.filter((v) => v > 0.5).length;
      expect(nonZeroCount).toBe(1);
    }

    for (let i = 0; i < box.uvs.length; i++) {
      expect(box.uvs[i]).toBeGreaterThanOrEqual(0);
      expect(box.uvs[i]).toBeLessThanOrEqual(1);
    }

    // Basic index sanity and first triangle non-degenerate.
    const indices = box.indices;
    for (let i = 0; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(0);
      expect(indices[i]).toBeLessThan(box.vertexCount);
    }

    const i0 = indices[0] * 3;
    const i1 = indices[1] * 3;
    const i2 = indices[2] * 3;
    const p = box.positions;

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

  it("should support high tessellation without index overflow", () => {
    const box = new BoxGeometry(2, 2, 2, 50, 50, 50);
    expect(box.vertexCount).toBe(15606);
    expect(box.indices.length).toBe(box.indexCount);

    for (let i = 0; i < box.indices.length; i++) {
      expect(box.indices[i]).toBeGreaterThanOrEqual(0);
      expect(box.indices[i]).toBeLessThan(box.vertexCount);
    }
  });
});
