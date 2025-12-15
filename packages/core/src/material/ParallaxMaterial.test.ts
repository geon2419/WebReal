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
      expect(material.selfShadow).toBe(false);
      expect(material.selfShadowStrength).toBe(0.35);
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
        selfShadow: true,
        selfShadowStrength: 0.8,
      });
      expect(material.normal).toBe(normalTexture);
      expect(material.depthScale).toBe(0.08);
      expect(material.normalScale).toBe(1.5);
      expect(material.shininess).toBe(64.0);
      expect(material.generateNormalFromDepth).toBe(false);
      expect(material.selfShadow).toBe(true);
      expect(material.selfShadowStrength).toBe(0.8);
    });

    it("should allow toggling selfShadow at runtime", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      expect(material.selfShadow).toBe(false);
      material.selfShadow = true;
      expect(material.selfShadow).toBe(true);
      material.selfShadow = false;
      expect(material.selfShadow).toBe(false);
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

  describe("getTextures", () => {
    it("should return albedo, depth, and normal textures when all provided", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
        normal: normalTexture,
      });
      const mockDevice = {} as GPUDevice;
      const textures = material.getTextures(mockDevice);

      expect(textures).toHaveLength(3);
      expect(textures[0]).toBe(albedoTexture);
      expect(textures[1]).toBe(depthTexture);
      expect(textures[2]).toBe(normalTexture);
    });

    it("should create dummy normal texture when not provided", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      // Mock WebGPU globals
      (globalThis as any).GPUTextureUsage = {
        TEXTURE_BINDING: 0x04,
        COPY_DST: 0x08,
        RENDER_ATTACHMENT: 0x10,
      };

      const mockDevice = {
        createTexture: () => ({} as GPUTexture),
        createSampler: () => ({} as GPUSampler),
        queue: {
          writeTexture: () => {},
        },
      } as unknown as GPUDevice;

      const textures = material.getTextures(mockDevice);

      expect(textures).toHaveLength(3);
      expect(textures[0]).toBe(albedoTexture);
      expect(textures[1]).toBe(depthTexture);
      expect(textures[2]).toBeInstanceOf(Texture);

      delete (globalThis as any).GPUTextureUsage;
    });

    it("should throw error when no normal texture and no device provided", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      expect(() => material.getTextures()).toThrow(
        "ParallaxMaterial.getTextures() requires a GPUDevice parameter when no normal texture is provided"
      );
    });
  });

  describe("writeUniformData with rendering context", () => {
    it("should write camera position from world matrix", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      const mockCamera = {
        worldMatrix: {
          data: new Float32Array([
            1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 10, 15, 1,
          ]),
        },
      };

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64, { camera: mockCamera } as any);

      // Camera position at offset+64 (64+64=128)
      expect(dataView.getFloat32(128, true)).toBe(5);
      expect(dataView.getFloat32(132, true)).toBe(10);
      expect(dataView.getFloat32(136, true)).toBe(15);
    });

    it("should write model matrix from mesh", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      const testMatrix = new Float32Array(16);
      for (let i = 0; i < 16; i++) {
        testMatrix[i] = i + 1;
      }

      const mockMesh = {
        worldMatrix: { data: testMatrix },
      };

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64, { mesh: mockMesh } as any);

      // Model matrix at offset+0
      for (let i = 0; i < 16; i++) {
        expect(dataView.getFloat32(64 + i * 4, true)).toBe(i + 1);
      }
    });

    it("should write AmbientLight when provided", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      const { AmbientLight } = require("../light/AmbientLight");
      const { Color } = require("@web-real/math");
      const ambient = new AmbientLight(new Color(0.5, 0.6, 0.7), 0.8);

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64, { lights: [ambient] } as any);

      // Ambient light at offset+96 (64+96=160)
      expect(dataView.getFloat32(160, true)).toBeCloseTo(0.5);
      expect(dataView.getFloat32(164, true)).toBeCloseTo(0.6);
      expect(dataView.getFloat32(168, true)).toBeCloseTo(0.7);
      expect(dataView.getFloat32(172, true)).toBeCloseTo(0.8);
    });

    it("should write PointLight data correctly", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      const { PointLight } = require("../light/PointLight");
      const { Color } = require("@web-real/math");
      const pointLight = new PointLight(
        new Color(1, 0, 0),
        2.0,
        15,
        "quadratic"
      );
      pointLight.position.set(3, 4, 5);
      pointLight.updateWorldMatrix(true, false);

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64, { lights: [pointLight] } as any);

      // Light count at offset+112 (64+112=176)
      expect(dataView.getFloat32(176, true)).toBe(1);

      // First light at offset+128 (64+128=192)
      // Position
      expect(dataView.getFloat32(192, true)).toBeCloseTo(3);
      expect(dataView.getFloat32(196, true)).toBeCloseTo(4);
      expect(dataView.getFloat32(200, true)).toBeCloseTo(5);

      // Color + intensity
      expect(dataView.getFloat32(208, true)).toBe(1);
      expect(dataView.getFloat32(212, true)).toBe(0);
      expect(dataView.getFloat32(216, true)).toBe(0);
      expect(dataView.getFloat32(220, true)).toBe(2);

      // Light type: 1.0 = point
      expect(dataView.getFloat32(224, true)).toBe(1);
    });

    it("should write DirectionalLight data correctly", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      const { DirectionalLight } = require("../light/DirectionalLight");
      const { Color, Vector3 } = require("@web-real/math");
      const dirLight = new DirectionalLight(
        new Vector3(0, -1, 0),
        new Color(1, 1, 0.8),
        1.5
      );

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64, { lights: [dirLight] } as any);

      // Light count
      expect(dataView.getFloat32(176, true)).toBe(1);

      // First light at offset+128 (64+128=192)
      // Direction (stored in position slot)
      expect(dataView.getFloat32(192, true)).toBeCloseTo(0);
      expect(dataView.getFloat32(196, true)).toBeCloseTo(-1);
      expect(dataView.getFloat32(200, true)).toBeCloseTo(0);

      // Color + intensity
      expect(dataView.getFloat32(208, true)).toBe(1);
      expect(dataView.getFloat32(212, true)).toBe(1);
      expect(dataView.getFloat32(216, true)).toBeCloseTo(0.8);
      expect(dataView.getFloat32(220, true)).toBeCloseTo(1.5);

      // Light type: 0.0 = directional
      expect(dataView.getFloat32(224, true)).toBe(0);
    });

    it("should handle multiple lights up to 4", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      const { PointLight } = require("../light/PointLight");
      const { DirectionalLight } = require("../light/DirectionalLight");
      const { AmbientLight } = require("../light/AmbientLight");
      const { Color, Vector3 } = require("@web-real/math");

      const lights = [
        new AmbientLight(new Color(0.2, 0.2, 0.2), 0.3),
        new PointLight(new Color(1, 0, 0), 1.0),
        new DirectionalLight(new Vector3(0, -1, 0), new Color(1, 1, 1), 1.0),
        new PointLight(new Color(0, 1, 0), 1.0),
      ];

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64, { lights } as any);

      // Should count 3 lights (excluding ambient)
      expect(dataView.getFloat32(176, true)).toBe(3);

      // First light type (PointLight)
      expect(dataView.getFloat32(224, true)).toBe(1);

      // Second light type (DirectionalLight)
      expect(dataView.getFloat32(224 + 48, true)).toBe(0);

      // Third light type (PointLight)
      expect(dataView.getFloat32(224 + 96, true)).toBe(1);
    });

    it("should limit to 4 lights maximum", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
      });

      const { PointLight } = require("../light/PointLight");
      const { Color } = require("@web-real/math");

      const lights = Array.from(
        { length: 6 },
        () => new PointLight(new Color(1, 1, 1), 1.0)
      );

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64, { lights } as any);

      // Should only write 4 lights
      expect(dataView.getFloat32(176, true)).toBe(4);
    });

    it("should write correct feature flags", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
        invertHeight: true,
        generateNormalFromDepth: true,
        selfShadow: true,
      });

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64);

      // Feature flags at offset+124 (64+124=188)
      // Flags: bit0=invertHeight, bit1=generateNormalFromDepth, bit2=selfShadow
      // Expected: 1 | 2 | 4 = 7
      expect(dataView.getFloat32(188, true)).toBe(7);
    });

    it("should write selfShadowStrength when enabled", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
        selfShadow: true,
        selfShadowStrength: 0.6,
      });

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64);

      // Self-shadow strength at offset+116 (64+116=180)
      expect(dataView.getFloat32(180, true)).toBeCloseTo(0.6);
    });

    it("should write 0 selfShadowStrength when disabled", () => {
      const material = new ParallaxMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
        selfShadow: false,
        selfShadowStrength: 0.6,
      });

      const buffer = new ArrayBuffer(material.getUniformBufferSize());
      const dataView = new DataView(buffer);

      material.writeUniformData(dataView, 64);

      // Should be 0 when selfShadow is disabled
      expect(dataView.getFloat32(180, true)).toBe(0);
    });
  });
});
