import { describe, it, expect } from "bun:test";
import { Color } from "@web-real/math";

import { PBRMaterial } from "./PBRMaterial";
import { AmbientLight } from "../light/AmbientLight";

describe("PBRMaterial", () => {
  describe("constructor", () => {
    it("should create a material with default parameters", () => {
      const material = new PBRMaterial();

      expect(material.type).toBe("pbr");
      expect(material.color.r).toBe(1.0);
      expect(material.metalness).toBe(0.0);
      expect(material.roughness).toBe(0.5);
      expect(material.wireframe).toBe(false);
    });

    it("should create a material with custom options", () => {
      const material = new PBRMaterial({
        color: [0.5, 0.3, 0.8],
        metalness: 1.0,
        roughness: 0.2,
        wireframe: true,
      });

      expect(material.color.r).toBe(0.5);
      expect(material.color.g).toBe(0.3);
      expect(material.color.b).toBe(0.8);
      expect(material.metalness).toBe(1.0);
      expect(material.roughness).toBe(0.2);
      expect(material.wireframe).toBe(true);
    });
  });

  describe("setters", () => {
    it("should set color", () => {
      const material = new PBRMaterial();
      material.setColor([0.4, 0.5, 0.6]);

      expect(material.color.r).toBe(0.4);
      expect(material.color.g).toBe(0.5);
      expect(material.color.b).toBe(0.6);
    });

    it("should set metalness within valid range", () => {
      const material = new PBRMaterial();
      material.setMetalness(0.5);
      expect(material.metalness).toBe(0.5);
    });

    it("should throw error for invalid metalness", () => {
      const material = new PBRMaterial();
      expect(() => material.setMetalness(-0.1)).toThrow();
      expect(() => material.setMetalness(1.1)).toThrow();
    });

    it("should set roughness within valid range", () => {
      const material = new PBRMaterial();
      material.setRoughness(0.8);
      expect(material.roughness).toBe(0.8);
    });

    it("should throw error for invalid roughness", () => {
      const material = new PBRMaterial();
      expect(() => material.setRoughness(-0.1)).toThrow();
      expect(() => material.setRoughness(1.1)).toThrow();
    });

    it("should throw error for invalid normalScale", () => {
      const material = new PBRMaterial();
      expect(() => material.setNormalScale(-0.1)).toThrow();
      expect(() => material.setNormalScale(3.1)).toThrow();
    });

    it("should throw error for negative emissiveIntensity", () => {
      const material = new PBRMaterial();
      expect(() => material.setEmissiveIntensity(-0.1)).toThrow();
    });

    it("should throw error for negative envMapIntensity", () => {
      const material = new PBRMaterial();
      expect(() => material.setEnvMapIntensity(-0.1)).toThrow();
    });
  });

  describe("getVertexBufferLayout", () => {
    it("should return correct vertex buffer layout", () => {
      const material = new PBRMaterial();
      const layout = material.getVertexBufferLayout();

      expect(layout.arrayStride).toBe(56);
      expect(layout.attributes).toHaveLength(5);
      expect(layout.attributes[0].shaderLocation).toBe(0);
      expect(layout.attributes[0].format).toBe("float32x3");
    });
  });

  describe("getUniformBufferSize", () => {
    it("should return 512 bytes", () => {
      const material = new PBRMaterial();
      expect(material.getUniformBufferSize()).toBe(512);
    });
  });

  describe("getPrimitiveTopology", () => {
    it("should return triangle-list by default", () => {
      const material = new PBRMaterial();
      expect(material.getPrimitiveTopology()).toBe("triangle-list");
    });

    it("should return line-list when wireframe is enabled", () => {
      const material = new PBRMaterial({ wireframe: true });
      expect(material.getPrimitiveTopology()).toBe("line-list");
    });
  });

  describe("getTextures", () => {
    it("should throw error when device is not provided", () => {
      const material = new PBRMaterial();
      expect(() => material.getTextures()).toThrow();
    });
  });

  describe("getVertexShader and getFragmentShader", () => {
    it("should return shader source code strings", () => {
      const material = new PBRMaterial();
      const vertexShader = material.getVertexShader();
      const fragmentShader = material.getFragmentShader();

      expect(typeof vertexShader).toBe("string");
      expect(typeof fragmentShader).toBe("string");
      expect(vertexShader.length).toBeGreaterThan(0);
      expect(fragmentShader.length).toBeGreaterThan(0);
    });
  });

  describe("writeUniformData", () => {
    it("should write baseColor to correct buffer position", () => {
      const material = new PBRMaterial({ color: [0.5, 0.6, 0.7] });
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 64);

      // baseColor at offset+128 (absolute position 192)
      expect(view.getFloat32(192, true)).toBeCloseTo(0.5, 5);
      expect(view.getFloat32(196, true)).toBeCloseTo(0.6, 5);
      expect(view.getFloat32(200, true)).toBeCloseTo(0.7, 5);
      expect(view.getFloat32(204, true)).toBe(1.0); // alpha
    });

    it("should write pbrParams to correct buffer position", () => {
      const material = new PBRMaterial({
        metalness: 0.8,
        roughness: 0.3,
        aoMapIntensity: 0.6,
        normalScale: 1.5,
      });
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 64);

      // pbrParams at offset+144 (absolute position 208)
      expect(view.getFloat32(208, true)).toBeCloseTo(0.8, 5); // metalness
      expect(view.getFloat32(212, true)).toBeCloseTo(0.3, 5); // roughness
      expect(view.getFloat32(216, true)).toBeCloseTo(0.6, 5); // aoMapIntensity
      expect(view.getFloat32(220, true)).toBeCloseTo(1.5, 5); // normalScale
    });

    it("should write emissive to correct buffer position", () => {
      const material = new PBRMaterial({
        emissive: [0.9, 0.4, 0.2],
        emissiveIntensity: 2.5,
      });
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 64);

      // emissive at offset+160 (absolute position 224)
      expect(view.getFloat32(224, true)).toBeCloseTo(0.9, 5);
      expect(view.getFloat32(228, true)).toBeCloseTo(0.4, 5);
      expect(view.getFloat32(232, true)).toBeCloseTo(0.2, 5);
      expect(view.getFloat32(236, true)).toBeCloseTo(2.5, 5);
    });

    it("should write envParams to correct buffer position", () => {
      const material = new PBRMaterial({ envMapIntensity: 1.8 });
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 64);

      // envParams at offset+176 (absolute position 240)
      expect(view.getFloat32(240, true)).toBeCloseTo(1.8, 5); // envMapIntensity
      expect(view.getFloat32(248, true)).toBe(0.0); // hasEnvMap (no envMap set)
    });

    it("should write default ambient light when no lights provided", () => {
      const material = new PBRMaterial();
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 64);

      // ambientLight at offset+208 (absolute position 272)
      expect(view.getFloat32(272, true)).toBe(1.0); // r
      expect(view.getFloat32(276, true)).toBe(1.0); // g
      expect(view.getFloat32(280, true)).toBe(1.0); // b
      expect(view.getFloat32(284, true)).toBeCloseTo(0.03, 5); // intensity
    });

    it("should write light count to envParams", () => {
      const material = new PBRMaterial();
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 64);

      // lightCount at offset+180 (absolute position 244)
      expect(view.getFloat32(244, true)).toBe(0);
    });

    it("should handle custom offset parameter", () => {
      const material = new PBRMaterial({ color: [0.1, 0.2, 0.3] });
      const buffer = new ArrayBuffer(600); // Larger buffer for custom offset
      const view = new DataView(buffer);

      // Write with different offset
      material.writeUniformData(view, 100);

      // baseColor at offset+128 (100+128=228)
      expect(view.getFloat32(228, true)).toBeCloseTo(0.1, 5);
      expect(view.getFloat32(232, true)).toBeCloseTo(0.2, 5);
      expect(view.getFloat32(236, true)).toBeCloseTo(0.3, 5);
    });

    it("should write all properties correctly in single call", () => {
      const material = new PBRMaterial({
        color: [1.0, 0.5, 0.25],
        metalness: 0.9,
        roughness: 0.1,
        normalScale: 2.0,
        aoMapIntensity: 0.8,
        emissive: [0.1, 0.2, 0.3],
        emissiveIntensity: 1.5,
        envMapIntensity: 2.0,
      });
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 64);

      // Verify multiple properties
      expect(view.getFloat32(192, true)).toBeCloseTo(1.0, 5); // color.r
      expect(view.getFloat32(208, true)).toBeCloseTo(0.9, 5); // metalness
      expect(view.getFloat32(212, true)).toBeCloseTo(0.1, 5); // roughness
      expect(view.getFloat32(220, true)).toBeCloseTo(2.0, 5); // normalScale
      expect(view.getFloat32(224, true)).toBeCloseTo(0.1, 5); // emissive.r
      expect(view.getFloat32(236, true)).toBeCloseTo(1.5, 5); // emissiveIntensity
      expect(view.getFloat32(240, true)).toBeCloseTo(2.0, 5); // envMapIntensity
    });
  });
});

describe("AmbientLight", () => {
  describe("constructor", () => {
    it("should create with default values", () => {
      const light = new AmbientLight();

      expect(light.color.r).toBe(1);
      expect(light.color.g).toBe(1);
      expect(light.color.b).toBe(1);
      expect(light.intensity).toBe(0.1);
    });

    it("should create with custom values", () => {
      const light = new AmbientLight(new Color(0.5, 0.5, 0.5), 0.3);

      expect(light.color.r).toBe(0.5);
      expect(light.color.g).toBe(0.5);
      expect(light.color.b).toBe(0.5);
      expect(light.intensity).toBe(0.3);
    });
  });

  describe("properties", () => {
    it("should allow modifying color and intensity", () => {
      const light = new AmbientLight();
      light.color = new Color(0.2, 0.4, 0.6);
      light.intensity = 0.5;

      expect(light.color.r).toBe(0.2);
      expect(light.color.g).toBe(0.4);
      expect(light.color.b).toBe(0.6);
      expect(light.intensity).toBe(0.5);
    });
  });
});
