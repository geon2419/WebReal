import { describe, it, expect, beforeAll } from "bun:test";
import { ParallaxMaterial } from "./ParallaxMaterial";
import { Texture } from "../texture";

// Mock Texture for testing
function createMockTexture(): Texture {
  const mockGPUTexture = {} as GPUTexture;
  const mockSampler = {} as GPUSampler;
  return new Texture(mockGPUTexture, mockSampler, 256, 256, "rgba8unorm", 1);
}

describe("ParallaxMaterial", () => {
  let albedoTexture: Texture;
  let depthTexture: Texture;
  let normalTexture: Texture;

  beforeAll(() => {
    albedoTexture = createMockTexture();
    depthTexture = createMockTexture();
    normalTexture = createMockTexture();
  });

  describe("constructor", () => {
    it("should initialize with required albedo and depth textures", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      expect(material.albedo).toBe(albedoTexture);
      expect(material.depth).toBe(depthTexture);
    });

    it("should initialize with default values", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      expect(material.depthScale).toBe(0.05);
      expect(material.normalScale).toBe(1.0);
      expect(material.shininess).toBe(32.0);
      expect(material.generateNormalFromDepth).toBe(true);
    });

    it("should initialize with custom values", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
        normal: normalTexture,
        depthScale: 0.08,
        normalScale: 1.5,
        shininess: 64.0,
        generateNormalFromDepth: false,
      });
      expect(material.normal).toBe(normalTexture);
      expect(material.depthScale).toBe(0.08);
      expect(material.normalScale).toBe(1.5);
      expect(material.shininess).toBe(64.0);
      expect(material.generateNormalFromDepth).toBe(false);
    });

    it("should have correct type", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      expect(material.type).toBe("parallax");
    });
  });

  describe("getVertexBufferLayout", () => {
    it("should return layout with 56-byte stride", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const layout = material.getVertexBufferLayout();
      expect(layout.arrayStride).toBe(56);
    });

    it("should have 5 attributes for position, normal, uv, tangent, bitangent", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const layout = material.getVertexBufferLayout();
      expect(layout.attributes).toHaveLength(5);
    });

    it("should have correct attribute offsets", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const layout = material.getVertexBufferLayout();

      expect(layout.attributes[0].offset).toBe(0); // position
      expect(layout.attributes[1].offset).toBe(12); // normal
      expect(layout.attributes[2].offset).toBe(24); // uv
      expect(layout.attributes[3].offset).toBe(32); // tangent
      expect(layout.attributes[4].offset).toBe(44); // bitangent
    });

    it("should have correct attribute formats", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const layout = material.getVertexBufferLayout();

      expect(layout.attributes[0].format).toBe("float32x3"); // position
      expect(layout.attributes[1].format).toBe("float32x3"); // normal
      expect(layout.attributes[2].format).toBe("float32x2"); // uv
      expect(layout.attributes[3].format).toBe("float32x3"); // tangent
      expect(layout.attributes[4].format).toBe("float32x3"); // bitangent
    });
  });

  describe("getUniformBufferSize", () => {
    it("should return 384 bytes", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      // Total UBO size includes MVP (64 bytes) + material-specific block
      expect(material.getUniformBufferSize()).toBe(384);
    });
  });

  describe("getPrimitiveTopology", () => {
    it("should return triangle-list", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      expect(material.getPrimitiveTopology()).toBe("triangle-list");
    });
  });

  describe("writeUniformData", () => {
    it("should write material parameters at correct offsets", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
        normal: normalTexture,
        depthScale: 0.06,
        normalScale: 1.2,
        shininess: 48.0,
      });
      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64);

      // Material params at offset+80 (64+80=144)
      expect(dataView.getFloat32(144, true)).toBeCloseTo(0.06); // depthScale
      expect(dataView.getFloat32(148, true)).toBeCloseTo(1.2); // normalScale
      expect(dataView.getFloat32(152, true)).toBe(1); // hasNormalMap
      expect(dataView.getFloat32(156, true)).toBeCloseTo(48.0); // shininess
    });

    it("should write default light data when no light provided", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64);

      // No explicit lights provided => ambient fallback and lightCount=0.
      // Ambient light at offset+96 (64+96=160): rgb=1, intensity=0.1
      expect(dataView.getFloat32(160, true)).toBe(1);
      expect(dataView.getFloat32(164, true)).toBe(1);
      expect(dataView.getFloat32(168, true)).toBe(1);
      expect(dataView.getFloat32(172, true)).toBeCloseTo(0.1);

      // Light count at offset+112 (64+112=176)
      expect(dataView.getFloat32(176, true)).toBe(0);

      // First light slot begins at offset+128 (64+128=192) and should be zeroed
      expect(dataView.getFloat32(192, true)).toBe(0);
      expect(dataView.getFloat32(196, true)).toBe(0);
      expect(dataView.getFloat32(200, true)).toBe(0);
    });

    it("should set hasNormalMap to 0 when no normal texture provided", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64);

      // hasNormalMap at offset+88 (64+88=152)
      expect(dataView.getFloat32(152, true)).toBe(0);
    });
  });

  describe("shader methods", () => {
    it("should return vertex shader string", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const shader = material.getVertexShader();
      expect(typeof shader).toBe("string");
      expect(shader.length).toBeGreaterThan(0);
    });

    it("should return fragment shader string", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });
      const shader = material.getFragmentShader();
      expect(typeof shader).toBe("string");
      expect(shader.length).toBeGreaterThan(0);
    });
  });
});
