import { describe, it, expect } from "bun:test";
import { FrustumGeometry } from "./FrustumGeometry";
import { PerspectiveCamera } from "../camera/PerspectiveCamera";
import { OrthographicCamera } from "../camera/OrthographicCamera";
import { Color, Vector3 } from "@web-real/math";

describe("FrustumGeometry", () => {
  const EPSILON = 1e-6;

  function hasAnyDifference(
    a: ArrayLike<number>,
    b: ArrayLike<number>
  ): boolean {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > 1e-4) return true;
    }
    return false;
  }

  function expectColorAt(
    colors: Float32Array,
    vertexIndex: number,
    expected: Color
  ): void {
    const base = vertexIndex * 3;
    expect(colors[base]).toBeCloseTo(expected.r, 5);
    expect(colors[base + 1]).toBeCloseTo(expected.g, 5);
    expect(colors[base + 2]).toBeCloseTo(expected.b, 5);
  }

  it("should generate non-indexed line-list geometry for perspective camera", () => {
    const camera = new PerspectiveCamera({ fov: 60, aspect: 16 / 9 });
    const frustum = new FrustumGeometry(camera);

    // Contract: 16 line segments → 32 vertices (line-list, non-indexed)
    expect(frustum.vertexCount).toBe(32);
    expect(frustum.indexCount).toBe(0);
    expect(frustum.indices.length).toBe(0);
    expect(frustum.normals.length).toBe(0);

    // 3 components per vertex
    expect(frustum.positions.length).toBe(32 * 3);
    expect(frustum.colors.length).toBe(32 * 3);

    // Sanity: finite coordinates
    for (let i = 0; i < frustum.positions.length; i++) {
      expect(Number.isFinite(frustum.positions[i])).toBe(true);
    }
  });

  it("should support orthographic camera", () => {
    const camera = new OrthographicCamera({
      left: -5,
      right: 5,
      top: 5,
      bottom: -5,
      near: 0.1,
      far: 50,
    });
    const frustum = new FrustumGeometry(camera);

    expect(frustum.vertexCount).toBe(32);
    expect(frustum.positions.length).toBe(32 * 3);
    expect(frustum.colors.length).toBe(32 * 3);
  });

  it("should update positions when camera projection or transform changes", () => {
    const camera = new PerspectiveCamera({
      fov: 60,
      aspect: 1,
      near: 0.1,
      far: 10,
    });
    camera.position.set(0, 0, 5);
    camera.lookAt(new Vector3(0, 0, 0));

    const frustum = new FrustumGeometry(camera);
    const before = Array.from(frustum.positions);

    camera.fov = 90;
    camera.position.set(3, 1, 7);
    camera.lookAt(new Vector3(0, 0, 0));
    frustum.update(camera);
    const after = Array.from(frustum.positions);

    expect(hasAnyDifference(before, after)).toBe(true);
  });

  it("should include camera position in cone lines", () => {
    const camera = new PerspectiveCamera({ near: 1, far: 10, aspect: 1 });
    camera.position.set(10, 20, 30);
    const frustum = new FrustumGeometry(camera);

    // Cone lines are the last 4 segments → last 8 vertices.
    // Each cone line starts at camera position.
    const positions = frustum.positions;
    const coneStartVertex0 = 24; // first vertex of first cone segment
    const base = coneStartVertex0 * 3;
    expect(positions[base]).toBeCloseTo(10, 6);
    expect(positions[base + 1]).toBeCloseTo(20, 6);
    expect(positions[base + 2]).toBeCloseTo(30, 6);
  });

  it("should apply per-part colors and allow updating colors via setColors", () => {
    const camera = new PerspectiveCamera();
    const initialNear = new Color(1, 0, 0);
    const initialFar = new Color(0, 1, 0);
    const initialSides = new Color(0, 0, 1);
    const initialCone = new Color(1, 1, 1);

    const frustum = new FrustumGeometry(camera, {
      near: initialNear,
      far: initialFar,
      sides: initialSides,
      cone: initialCone,
    });

    // Segment grouping in implementation:
    // near: vertices 0..7, far: 8..15, sides: 16..23, cone: 24..31
    expectColorAt(frustum.colors, 0, initialNear);
    expectColorAt(frustum.colors, 8, initialFar);
    expectColorAt(frustum.colors, 16, initialSides);
    expectColorAt(frustum.colors, 24, initialCone);

    const updatedNear = new Color(1, 1, 0);
    frustum.setColors({ near: updatedNear });
    frustum.update(camera);

    expectColorAt(frustum.colors, 0, updatedNear);

    // Colors should remain normalized
    for (let i = 0; i < frustum.colors.length; i++) {
      expect(frustum.colors[i]).toBeGreaterThanOrEqual(0 - EPSILON);
      expect(frustum.colors[i]).toBeLessThanOrEqual(1 + EPSILON);
    }
  });
});
