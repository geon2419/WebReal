import { describe, it, expect } from "bun:test";
import { computeBoundingBox, computeBoundingSphere } from "./BoundingUtils";
import { BoxGeometry } from "./BoxGeometry";
import { Vector3, BoundingBox, BoundingSphere } from "@web-real/math";

describe("BoundingUtils", () => {
  it("should return BoundingBox and BoundingSphere for a geometry", () => {
    const geometry = new BoxGeometry(2, 2, 2);

    const boundingBox = computeBoundingBox(geometry);
    const boundingSphere = computeBoundingSphere(geometry);

    expect(boundingBox).toBeInstanceOf(BoundingBox);
    expect(boundingBox.min).toBeInstanceOf(Vector3);
    expect(boundingBox.max).toBeInstanceOf(Vector3);

    expect(boundingSphere).toBeInstanceOf(BoundingSphere);
    expect(boundingSphere.center).toBeInstanceOf(Vector3);
    expect(boundingSphere.radius).toBeGreaterThan(0);
  });

  it("should compute expected bounds for a centered box", () => {
    const width = 4;
    const height = 6;
    const depth = 8;
    const geometry = new BoxGeometry(width, height, depth);

    const boundingBox = computeBoundingBox(geometry);
    expect(boundingBox.min.x).toBeCloseTo(-width / 2, 5);
    expect(boundingBox.max.x).toBeCloseTo(width / 2, 5);
    expect(boundingBox.min.y).toBeCloseTo(-height / 2, 5);
    expect(boundingBox.max.y).toBeCloseTo(height / 2, 5);
    expect(boundingBox.min.z).toBeCloseTo(-depth / 2, 5);
    expect(boundingBox.max.z).toBeCloseTo(depth / 2, 5);
  });
});
