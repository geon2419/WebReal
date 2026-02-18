import { describe, it, expect } from "bun:test";
import { Color, Vector3 } from "@web-real/math";

import { BlinnPhongMaterial } from "./BlinnPhongMaterial";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";
import { PerspectiveCamera } from "../camera/PerspectiveCamera";
import type { RenderContext } from "./Material";

const DEFAULT_OFFSET = 64;

function createUniformView(byteLength = 512): DataView {
  return new DataView(new ArrayBuffer(byteLength));
}

function createRenderContext(lights: RenderContext["lights"]): RenderContext {
  return {
    camera: new PerspectiveCamera(),
    lights,
  };
}

describe("BlinnPhongMaterial", () => {
  it("should expose sensible defaults", () => {
    const material = new BlinnPhongMaterial();

    expect(material.type).toBe("blinnPhong");
    expect(material.color.r).toBe(1);
    expect(material.color.g).toBe(1);
    expect(material.color.b).toBe(1);
    expect(material.shininess).toBe(32);
    expect(material.wireframe).toBe(false);
    expect(material.displacementScale).toBe(1);
    expect(material.displacementBias).toBe(0);
    expect(material.normalScale).toBe(1);
  });

  it("should accept color as Color or RGB tuple", () => {
    const byInstance = new BlinnPhongMaterial({
      color: new Color(0.2, 0.4, 0.6),
    });
    expect(byInstance.color.r).toBeCloseTo(0.2, 5);
    expect(byInstance.color.g).toBeCloseTo(0.4, 5);
    expect(byInstance.color.b).toBeCloseTo(0.6, 5);

    const byTuple = new BlinnPhongMaterial({ color: [0.1, 0.3, 0.9] });
    expect(byTuple.color.r).toBeCloseTo(0.1, 5);
    expect(byTuple.color.g).toBeCloseTo(0.3, 5);
    expect(byTuple.color.b).toBeCloseTo(0.9, 5);
  });

  it("should validate shininess range (1..256)", () => {
    const material = new BlinnPhongMaterial();

    material.setShininess(64);
    expect(material.shininess).toBe(64);

    expect(() => material.setShininess(0)).toThrow(
      "Shininess must be between 1 and 256",
    );
    expect(() => material.setShininess(257)).toThrow(
      "Shininess must be between 1 and 256",
    );
  });

  it("should validate displacement/normal ranges", () => {
    const material = new BlinnPhongMaterial();

    material.setNormalScale(1.5);
    expect(material.normalScale).toBeCloseTo(1.5, 5);
    expect(() => material.setNormalScale(-0.01)).toThrow(
      "Normal scale must be between 0 and 3",
    );
    expect(() => material.setNormalScale(3.01)).toThrow(
      "Normal scale must be between 0 and 3",
    );

    material.setDisplacementScale(2);
    expect(material.displacementScale).toBe(2);
    expect(() => material.setDisplacementScale(-0.01)).toThrow(
      "Displacement scale must be between 0 and 10",
    );
    expect(() => material.setDisplacementScale(10.01)).toThrow(
      "Displacement scale must be between 0 and 10",
    );

    material.setDisplacementBias(0.25);
    expect(material.displacementBias).toBeCloseTo(0.25, 5);
    expect(() => material.setDisplacementBias(-1.01)).toThrow(
      "Displacement bias must be between -1 and 1",
    );
    expect(() => material.setDisplacementBias(1.01)).toThrow(
      "Displacement bias must be between -1 and 1",
    );
  });

  it("should return a stable vertex buffer layout (position/normal/uv/tangent/bitangent)", () => {
    const material = new BlinnPhongMaterial();
    const layout = material.getVertexBufferLayout();

    expect(layout.arrayStride).toBe(56);
    expect(layout.attributes).toHaveLength(5);

    expect(layout.attributes[0]).toEqual({
      shaderLocation: 0,
      offset: 0,
      format: "float32x3",
    });
    expect(layout.attributes[2]).toEqual({
      shaderLocation: 2,
      offset: 24,
      format: "float32x2",
    });
    expect(layout.attributes[4]).toEqual({
      shaderLocation: 4,
      offset: 44,
      format: "float32x3",
    });
  });

  it("should require a GPUDevice for getTextures() in node test env", () => {
    const material = new BlinnPhongMaterial();
    expect(() => material.getTextures()).toThrow(
      "BlinnPhongMaterial.getTextures() requires a GPUDevice parameter",
    );
  });

  it("should select correct primitive topology based on wireframe", () => {
    expect(
      new BlinnPhongMaterial({ wireframe: false }).getPrimitiveTopology(),
    ).toBe("triangle-list");
    expect(
      new BlinnPhongMaterial({ wireframe: true }).getPrimitiveTopology(),
    ).toBe("line-list");
  });

  describe("writeUniformData", () => {
    it("should write color/shininess + displacement params at documented offsets", () => {
      const dataView = createUniformView();
      const material = new BlinnPhongMaterial({
        color: [0.5, 0.6, 0.7],
        shininess: 64,
        displacementScale: 2.5,
        displacementBias: -0.3,
        normalScale: 1.8,
      });

      material.writeUniformData(dataView, DEFAULT_OFFSET);

      // colorAndShininess at offset + 128
      expect(dataView.getFloat32(DEFAULT_OFFSET + 128, true)).toBeCloseTo(
        0.5,
        5,
      );
      expect(dataView.getFloat32(DEFAULT_OFFSET + 132, true)).toBeCloseTo(
        0.6,
        5,
      );
      expect(dataView.getFloat32(DEFAULT_OFFSET + 136, true)).toBeCloseTo(
        0.7,
        5,
      );
      expect(dataView.getFloat32(DEFAULT_OFFSET + 140, true)).toBeCloseTo(
        64,
        5,
      );

      // displacement params at offset + 224
      expect(dataView.getFloat32(DEFAULT_OFFSET + 224, true)).toBeCloseTo(
        2.5,
        5,
      );
      expect(dataView.getFloat32(DEFAULT_OFFSET + 228, true)).toBeCloseTo(
        -0.3,
        5,
      );
      expect(dataView.getFloat32(DEFAULT_OFFSET + 232, true)).toBeCloseTo(
        1.8,
        5,
      );
    });

    it("should write a default directional light when context has no lights", () => {
      const dataView = createUniformView();
      const material = new BlinnPhongMaterial();

      material.writeUniformData(dataView, DEFAULT_OFFSET);

      // Default direction at offset + 144
      expect(dataView.getFloat32(DEFAULT_OFFSET + 144, true)).toBe(0);
      expect(dataView.getFloat32(DEFAULT_OFFSET + 148, true)).toBe(-1);
      expect(dataView.getFloat32(DEFAULT_OFFSET + 152, true)).toBe(0);

      // Light type at offset + 208 (0 = directional)
      expect(dataView.getFloat32(DEFAULT_OFFSET + 208, true)).toBe(0);
    });

    it("should encode DirectionalLight vs PointLight types", () => {
      const dataView = createUniformView();
      const material = new BlinnPhongMaterial();

      const directional = new DirectionalLight(
        new Vector3(1, -1, 0),
        new Color(1, 0.5, 0.3),
        0.8,
      );
      material.writeUniformData(
        dataView,
        DEFAULT_OFFSET,
        createRenderContext([directional]),
      );
      expect(dataView.getFloat32(DEFAULT_OFFSET + 208, true)).toBe(0);
      expect(dataView.getFloat32(DEFAULT_OFFSET + 172, true)).toBeCloseTo(
        0.8,
        5,
      );

      const point = new PointLight(
        new Color(0.8, 0.9, 1.0),
        1.5,
        20,
        "quadratic",
      );
      material.writeUniformData(
        dataView,
        DEFAULT_OFFSET,
        createRenderContext([point]),
      );
      expect(dataView.getFloat32(DEFAULT_OFFSET + 208, true)).toBe(1);
      expect(dataView.getFloat32(DEFAULT_OFFSET + 212, true)).toBe(1); // quadratic
      expect(dataView.getFloat32(DEFAULT_OFFSET + 192, true)).toBe(20); // range
    });
  });
});
