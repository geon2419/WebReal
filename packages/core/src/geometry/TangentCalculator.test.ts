import { describe, it, expect } from "bun:test";
import { TangentCalculator } from "./TangentCalculator";

describe("TangentCalculator", () => {
  it("should calculate tangents and bitangents for a simple quad", () => {
    // Create a simple XY-plane quad
    const positions = new Float32Array([
      -1,
      -1,
      0, // bottom-left
      1,
      -1,
      0, // bottom-right
      1,
      1,
      0, // top-right
      -1,
      1,
      0, // top-left
    ]);

    const normals = new Float32Array([
      0,
      0,
      1, // all normals point in +Z
      0,
      0,
      1,
      0,
      0,
      1,
      0,
      0,
      1,
    ]);

    const uvs = new Float32Array([
      0,
      0, // bottom-left
      1,
      0, // bottom-right
      1,
      1, // top-right
      0,
      1, // top-left
    ]);

    const indices = new Uint16Array([
      0,
      1,
      2, // first triangle
      0,
      2,
      3, // second triangle
    ]);

    const result = TangentCalculator.calculate(
      positions,
      normals,
      uvs,
      indices,
    );

    expect(result.tangents).toBeDefined();
    expect(result.bitangents).toBeDefined();
    expect(result.tangents.length).toBe(12); // 4 vertices × 3 components
    expect(result.bitangents.length).toBe(12);

    // For an XY plane with standard UVs:
    // - Tangent should point in +X direction (1, 0, 0)
    // - Bitangent should point in +Y direction (0, 1, 0)

    // Check first vertex tangent (should be approximately +X)
    expect(result.tangents[0]).toBeCloseTo(1, 1);
    expect(result.tangents[1]).toBeCloseTo(0, 1);
    expect(result.tangents[2]).toBeCloseTo(0, 1);

    // Check first vertex bitangent (should be approximately +Y)
    expect(result.bitangents[0]).toBeCloseTo(0, 1);
    expect(result.bitangents[1]).toBeCloseTo(1, 1);
    expect(result.bitangents[2]).toBeCloseTo(0, 1);
  });

  it("should handle normalized tangents and bitangents", () => {
    const positions = new Float32Array([0, 0, 0, 2, 0, 0, 2, 2, 0]);

    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

    const uvs = new Float32Array([0, 0, 1, 0, 1, 1]);

    const indices = new Uint16Array([0, 1, 2]);

    const result = TangentCalculator.calculate(
      positions,
      normals,
      uvs,
      indices,
    );

    // Check that tangents are normalized
    for (let i = 0; i < 3; i++) {
      const tx = result.tangents[i * 3];
      const ty = result.tangents[i * 3 + 1];
      const tz = result.tangents[i * 3 + 2];
      const length = Math.sqrt(tx * tx + ty * ty + tz * tz);
      expect(length).toBeCloseTo(1, 5);
    }

    // Check that bitangents are normalized
    for (let i = 0; i < 3; i++) {
      const bx = result.bitangents[i * 3];
      const by = result.bitangents[i * 3 + 1];
      const bz = result.bitangents[i * 3 + 2];
      const length = Math.sqrt(bx * bx + by * by + bz * bz);
      expect(length).toBeCloseTo(1, 5);
    }
  });

  it("should produce orthogonal tangent space", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]);

    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

    const uvs = new Float32Array([0, 0, 1, 0, 1, 1]);

    const indices = new Uint16Array([0, 1, 2]);

    const result = TangentCalculator.calculate(
      positions,
      normals,
      uvs,
      indices,
    );

    // Check first vertex: tangent should be orthogonal to normal
    const t = [result.tangents[0], result.tangents[1], result.tangents[2]];
    const n = [normals[0], normals[1], normals[2]];
    const dot = t[0] * n[0] + t[1] * n[1] + t[2] * n[2];
    expect(Math.abs(dot)).toBeLessThan(0.001);
  });
});
