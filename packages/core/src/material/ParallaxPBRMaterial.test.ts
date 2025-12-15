import { describe, it, expect, beforeAll } from "bun:test";
import { ParallaxPBRMaterial } from "./ParallaxPBRMaterial";
import { Texture } from "../texture";
import { PointLight } from "../light/PointLight";
import { DirectionalLight } from "../light/DirectionalLight";
import { AmbientLight } from "../light/AmbientLight";
import type { RenderContext } from "./Material";
import { Vector3 } from "@web-real/math";
import { Color } from "@web-real/math";

// Mock GPU device and texture creation
const createMockTexture = (): Texture => {
  const mockGPUTexture = {
    label: "mock-texture",
    width: 1,
    height: 1,
    depthOrArrayLayers: 1,
  } as GPUTexture;

  const mockSampler = {} as GPUSampler;

  return new Texture(mockGPUTexture, mockSampler, 1, 1, "rgba8unorm", 1);
};

describe("ParallaxPBRMaterial", () => {
  let mockAlbedo: Texture;
  let mockDepth: Texture;

  beforeAll(() => {
    mockAlbedo = createMockTexture();
    mockDepth = createMockTexture();
  });

  describe("constructor", () => {
    it("should initialize with required textures only", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(material.albedo).toBe(mockAlbedo);
      expect(material.depth).toBe(mockDepth);
      expect(material.type).toBe("parallaxPbr");
    });

    it("should apply default PBR parameters", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(material.metalness).toBe(0.0);
      expect(material.roughness).toBe(0.5);
      expect(material.aoMapIntensity).toBe(1.0);
      expect(material.envMapIntensity).toBe(1.0);
    });

    it("should apply default parallax parameters", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(material.depthScale).toBe(0.05);
      expect(material.normalScale).toBe(1.0);
      expect(material.generateNormalFromDepth).toBe(true);
      expect(material.selfShadow).toBe(false);
      expect(material.selfShadowStrength).toBe(0.35);
      expect(material.invertHeight).toBe(true);
    });

    it("should initialize with custom parameters", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        metalness: 0.8,
        roughness: 0.3,
        depthScale: 0.1,
        selfShadow: true,
      });

      expect(material.metalness).toBe(0.8);
      expect(material.roughness).toBe(0.3);
      expect(material.depthScale).toBe(0.1);
      expect(material.selfShadow).toBe(true);
    });
  });

  describe("metalness property", () => {
    it("should accept valid values between 0 and 1", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      material.metalness = 0.0;
      expect(material.metalness).toBe(0.0);

      material.metalness = 0.5;
      expect(material.metalness).toBe(0.5);

      material.metalness = 1.0;
      expect(material.metalness).toBe(1.0);
    });

    it("should throw error for values outside range", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(() => {
        material.metalness = -0.1;
      }).toThrow("Metalness must be between 0 and 1");

      expect(() => {
        material.metalness = 1.1;
      }).toThrow("Metalness must be between 0 and 1");
    });
  });

  describe("roughness property", () => {
    it("should accept valid values between 0 and 1", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      material.roughness = 0.0;
      expect(material.roughness).toBe(0.0);

      material.roughness = 1.0;
      expect(material.roughness).toBe(1.0);
    });

    it("should throw error for values outside range", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(() => {
        material.roughness = -0.1;
      }).toThrow("Roughness must be between 0 and 1");

      expect(() => {
        material.roughness = 1.1;
      }).toThrow("Roughness must be between 0 and 1");
    });
  });

  describe("aoMapIntensity property", () => {
    it("should throw error for values outside valid range", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(() => {
        material.aoMapIntensity = -0.1;
      }).toThrow("AO map intensity must be between 0 and 1");

      expect(() => {
        material.aoMapIntensity = 1.1;
      }).toThrow("AO map intensity must be between 0 and 1");
    });
  });

  describe("envMapIntensity property", () => {
    it("should accept non-negative values", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      material.envMapIntensity = 0.0;
      expect(material.envMapIntensity).toBe(0.0);

      material.envMapIntensity = 2.5;
      expect(material.envMapIntensity).toBe(2.5);
    });

    it("should throw error for negative values", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(() => {
        material.envMapIntensity = -0.1;
      }).toThrow("Environment map intensity must be non-negative");
    });
  });

  describe("useIBL", () => {
    it("should return false when IBL textures are not set", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(material.useIBL).toBe(false);
    });

    it("should return false when only one IBL texture is set", () => {
      const mockCubeTexture = {
        mipLevelCount: 5,
      } as any;

      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        prefilteredMap: mockCubeTexture,
      });

      expect(material.useIBL).toBe(false);
    });

    it("should return true when both IBL textures are set", () => {
      const mockCubeTexture = {
        mipLevelCount: 5,
      } as any;

      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        prefilteredMap: mockCubeTexture,
        irradianceMap: mockCubeTexture,
      });

      expect(material.useIBL).toBe(true);
    });
  });

  describe("getVertexBufferLayout", () => {
    it("should return correct layout with 5 attributes", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      const layout = material.getVertexBufferLayout();

      expect(layout.arrayStride).toBe(56);
      expect(layout.attributes).toHaveLength(5);
      expect(layout.attributes[0].shaderLocation).toBe(0); // position
      expect(layout.attributes[1].shaderLocation).toBe(1); // normal
      expect(layout.attributes[2].shaderLocation).toBe(2); // uv
      expect(layout.attributes[3].shaderLocation).toBe(3); // tangent
      expect(layout.attributes[4].shaderLocation).toBe(4); // bitangent
    });
  });

  describe("getUniformBufferSize", () => {
    it("should return 512 bytes", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(material.getUniformBufferSize()).toBe(512);
    });
  });

  describe("writeUniformData", () => {
    it("should write PBR parameters at correct offsets", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        metalness: 0.7,
        roughness: 0.4,
        aoMapIntensity: 0.8,
        normalScale: 1.5,
      });

      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0);

      expect(view.getFloat32(144, true)).toBeCloseTo(0.7, 5); // metalness
      expect(view.getFloat32(148, true)).toBeCloseTo(0.4, 5); // roughness
      expect(view.getFloat32(152, true)).toBeCloseTo(0.8, 5); // aoMapIntensity
      expect(view.getFloat32(156, true)).toBeCloseTo(1.5, 5); // normalScale
    });

    it("should write parallax parameters at correct offsets", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        depthScale: 0.08,
        selfShadow: true,
        selfShadowStrength: 0.5,
      });

      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0);

      expect(view.getFloat32(160, true)).toBeCloseTo(0.08, 5); // depthScale
      expect(view.getFloat32(164, true)).toBeCloseTo(0.5, 5); // selfShadowStrength (active)
    });

    it("should write zero shadow strength when selfShadow is disabled", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        selfShadow: false,
        selfShadowStrength: 0.5,
      });

      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0);

      expect(view.getFloat32(164, true)).toBe(0); // selfShadowStrength should be 0
    });

    it("should write ambient light with default values when no lights provided", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0);

      expect(view.getFloat32(192, true)).toBeCloseTo(1.0, 5); // ambient R
      expect(view.getFloat32(196, true)).toBeCloseTo(1.0, 5); // ambient G
      expect(view.getFloat32(200, true)).toBeCloseTo(1.0, 5); // ambient B
      expect(view.getFloat32(204, true)).toBeCloseTo(0.03, 5); // ambient intensity
    });

    it("should write ambient light data from context", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      const ambientLight = new AmbientLight(new Color(0.5, 0.6, 0.7), 0.8);
      const context: RenderContext = {
        camera: {
          worldMatrix: {
            data: new Float32Array(16),
          },
        } as any,
        lights: [ambientLight],
      };

      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0, context);

      expect(view.getFloat32(192, true)).toBeCloseTo(0.5, 5); // ambient R
      expect(view.getFloat32(196, true)).toBeCloseTo(0.6, 5); // ambient G
      expect(view.getFloat32(200, true)).toBeCloseTo(0.7, 5); // ambient B
      expect(view.getFloat32(204, true)).toBeCloseTo(0.8, 5); // ambient intensity
    });

    it("should write environment mode correctly for IBL", () => {
      const mockCubeTexture = {
        mipLevelCount: 6,
      } as any;

      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        prefilteredMap: mockCubeTexture,
        irradianceMap: mockCubeTexture,
        envMapIntensity: 1.5,
      });

      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0);

      expect(view.getFloat32(176, true)).toBe(1.5); // envMapIntensity
      expect(view.getFloat32(184, true)).toBe(2.0); // envMode (IBL)
      expect(view.getFloat32(188, true)).toBe(5.0); // maxMipLevel (6-1)
    });

    it("should write environment mode correctly for simple env map", () => {
      const mockEnvMap = createMockTexture();
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
        envMap: mockEnvMap,
      });

      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0);

      expect(view.getFloat32(184, true)).toBe(1.0); // envMode (simple)
      expect(view.getFloat32(188, true)).toBe(8.0); // maxMipLevel (default)
    });

    it("should handle maximum number of lights (4)", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      const lights = [
        new PointLight(new Color(1, 0, 0), 1.0, 10),
        new PointLight(new Color(0, 1, 0), 1.0, 10),
        new PointLight(new Color(0, 0, 1), 1.0, 10),
        new PointLight(new Color(1, 1, 0), 1.0, 10),
        new PointLight(new Color(1, 0, 1), 1.0, 10), // 5th light should be ignored
      ];

      const context: RenderContext = {
        camera: {
          worldMatrix: {
            data: new Float32Array(16),
          },
        } as any,
        lights,
      };
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0, context);

      expect(view.getFloat32(180, true)).toBe(4.0); // light count should be 4
    });

    it("should write directional light correctly", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      const dirLight = new DirectionalLight(
        new Vector3(0, -1, 0),
        new Color(1, 0.8, 0.6),
        2.0
      );

      const context: RenderContext = {
        camera: {
          worldMatrix: {
            data: new Float32Array(16),
          },
        } as any,
        lights: [dirLight],
      };
      const buffer = new ArrayBuffer(512);
      const view = new DataView(buffer);

      material.writeUniformData(view, 0, context);

      // Light 0 direction
      expect(view.getFloat32(208, true)).toBe(0); // x
      expect(view.getFloat32(212, true)).toBe(-1); // y
      expect(view.getFloat32(216, true)).toBe(0); // z

      // Light 0 color
      expect(view.getFloat32(224, true)).toBeCloseTo(1, 5); // r
      expect(view.getFloat32(228, true)).toBeCloseTo(0.8, 5); // g
      expect(view.getFloat32(232, true)).toBeCloseTo(0.6, 5); // b
      expect(view.getFloat32(236, true)).toBeCloseTo(2.0, 5); // intensity
    });
  });

  describe("shader methods", () => {
    it("should return vertex shader string", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      const shader = material.getVertexShader();
      expect(typeof shader).toBe("string");
      expect(shader.length).toBeGreaterThan(0);
    });

    it("should return fragment shader string", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      const shader = material.getFragmentShader();
      expect(typeof shader).toBe("string");
      expect(shader.length).toBeGreaterThan(0);
    });
  });

  describe("getPrimitiveTopology", () => {
    it("should return triangle-list", () => {
      const material = new ParallaxPBRMaterial({
        albedo: mockAlbedo,
        depth: mockDepth,
      });

      expect(material.getPrimitiveTopology()).toBe("triangle-list");
    });
  });
});
