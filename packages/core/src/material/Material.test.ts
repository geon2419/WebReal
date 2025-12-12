import { describe, it, expect } from "bun:test";
import { Matrix4 } from "@web-real/math";

import type { RenderContext } from "./Material";
import { BasicMaterial } from "./BasicMaterial";
import { ShaderMaterial } from "./ShaderMaterial";
import { Camera } from "../camera/Camera";
import { BoxGeometry } from "../geometry/BoxGeometry";
import { Scene } from "../scene/Scene";
import { Mesh } from "../scene/Mesh";
import { PointLight } from "../light/PointLight";

// Concrete Camera implementation for testing
class TestCamera extends Camera {
  get projectionMatrix(): Matrix4 {
    return new Matrix4();
  }
}

describe("Material Interface", () => {
  describe("Material contract", () => {
    it("should have a readonly type property", () => {
      const material = new BasicMaterial();
      expect(material.type).toBeDefined();
      expect(typeof material.type).toBe("string");
    });

    it("should provide vertex shader code", () => {
      const material = new BasicMaterial();
      const shader = material.getVertexShader();
      expect(typeof shader).toBe("string");
      expect(shader.length).toBeGreaterThan(0);
    });

    it("should provide fragment shader code", () => {
      const material = new BasicMaterial();
      const shader = material.getFragmentShader();
      expect(typeof shader).toBe("string");
      expect(shader.length).toBeGreaterThan(0);
    });

    it("should provide vertex buffer layout", () => {
      const material = new BasicMaterial();
      const layout = material.getVertexBufferLayout();
      expect(layout).toBeDefined();
      expect(typeof layout.arrayStride).toBe("number");
      expect(Array.isArray(layout.attributes)).toBe(true);
      expect(layout.arrayStride).toBeGreaterThan(0);
    });

    it("should provide uniform buffer size", () => {
      const material = new BasicMaterial();
      const size = material.getUniformBufferSize();
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThan(0);
      expect(size).toBeGreaterThanOrEqual(64); // Minimum for MVP matrix
    });

    it("should provide primitive topology", () => {
      const material = new BasicMaterial();
      const topology = material.getPrimitiveTopology();
      expect(typeof topology).toBe("string");
      expect(topology).toBeDefined();
    });
  });

  describe("VertexBufferLayout structure", () => {
    it("should have valid arrayStride", () => {
      const material = new BasicMaterial();
      const layout = material.getVertexBufferLayout();

      expect(layout.arrayStride).toBeGreaterThan(0);
      expect(layout.arrayStride % 4).toBe(0); // Should be aligned to 4 bytes
    });

    it("should have attributes array with valid entries", () => {
      const material = new BasicMaterial();
      const layout = material.getVertexBufferLayout();

      expect(layout.attributes.length).toBeGreaterThan(0);

      layout.attributes.forEach((attr) => {
        expect(typeof attr.shaderLocation).toBe("number");
        expect(typeof attr.offset).toBe("number");
        expect(typeof attr.format).toBe("string");
        expect(attr.shaderLocation).toBeGreaterThanOrEqual(0);
        expect(attr.offset).toBeGreaterThanOrEqual(0);
      });
    });

    it("should have unique shader locations", () => {
      const material = new BasicMaterial();
      const layout = material.getVertexBufferLayout();

      const locations = layout.attributes.map((attr) => attr.shaderLocation);
      const uniqueLocations = new Set(locations);
      expect(uniqueLocations.size).toBe(locations.length);
    });

    it("should have valid GPUVertexFormat values", () => {
      const material = new BasicMaterial();
      const layout = material.getVertexBufferLayout();

      const validFormats = [
        "float32",
        "float32x2",
        "float32x3",
        "float32x4",
        "uint32",
        "uint32x2",
        "uint32x3",
        "uint32x4",
        "sint32",
        "sint32x2",
        "sint32x3",
        "sint32x4",
      ];

      layout.attributes.forEach((attr) => {
        expect(validFormats.includes(attr.format)).toBe(true);
      });
    });

    it("should have offsets within arrayStride", () => {
      const material = new BasicMaterial();
      const layout = material.getVertexBufferLayout();

      layout.attributes.forEach((attr) => {
        expect(attr.offset).toBeLessThan(layout.arrayStride);
      });
    });
  });

  describe("Optional methods", () => {
    it("should allow writeUniformData to be optional", () => {
      const simpleShader = `
        @vertex
        fn main(@location(0) position: vec3f) -> @builtin(position) vec4f {
          return vec4f(position, 1.0);
        }
      `;

      const material = new ShaderMaterial({
        vertexShader: simpleShader,
        fragmentShader: `
          @fragment
          fn main() -> @location(0) vec4f {
            return vec4f(1.0, 0.0, 0.0, 1.0);
          }
        `,
      });

      // Should not throw if writeUniformData is undefined
      expect(material.writeUniformData).toBeDefined();
    });
  });

  describe("writeUniformData method", () => {
    it("should write uniform data to buffer when implemented", () => {
      const material = new BasicMaterial({ color: [1.0, 0.5, 0.25] });
      const buffer = new ArrayBuffer(80);
      const dataView = new DataView(buffer);

      if (material.writeUniformData) {
        material.writeUniformData(dataView, 64);

        // Verify color was written at offset 64
        expect(dataView.getFloat32(64, true)).toBeCloseTo(1.0, 5);
        expect(dataView.getFloat32(68, true)).toBeCloseTo(0.5, 5);
        expect(dataView.getFloat32(72, true)).toBeCloseTo(0.25, 5);
        expect(dataView.getFloat32(76, true)).toBeCloseTo(1.0, 5); // Alpha
      }
    });

    it("should accept custom offset parameter", () => {
      const material = new BasicMaterial({ color: [0.1, 0.2, 0.3] });
      const buffer = new ArrayBuffer(128);
      const dataView = new DataView(buffer);

      if (material.writeUniformData) {
        material.writeUniformData(dataView, 96);

        // Verify color was written at custom offset 96
        expect(dataView.getFloat32(96, true)).toBeCloseTo(0.1, 5);
        expect(dataView.getFloat32(100, true)).toBeCloseTo(0.2, 5);
        expect(dataView.getFloat32(104, true)).toBeCloseTo(0.3, 5);
      }
    });
  });

  describe("RenderContext structure", () => {
    it("should contain required fields", () => {
      const camera = new TestCamera();
      const light = new PointLight();

      const context: RenderContext = {
        camera,
        lights: [light],
      };

      expect(context.camera).toBeDefined();
      expect(context.lights).toBeDefined();
    });

    it("should allow omitting scene and mesh", () => {
      const context: RenderContext = {
        camera: new TestCamera(),
        lights: [],
      };

      expect(context.scene).toBeUndefined();
      expect(context.mesh).toBeUndefined();
    });

    it("should have camera of type Camera", () => {
      const camera = new TestCamera();
      camera.position.set(0, 5, 10);

      const context: RenderContext = {
        camera,
        lights: [],
      };

      expect(context.camera).toBe(camera);
      expect(context.camera.position.y).toBe(5);
    });

    it("should have scene of type Scene", () => {
      const scene = new Scene();
      const mesh = new Mesh(new BoxGeometry(), new BasicMaterial());
      scene.add(mesh);

      const context: RenderContext = {
        camera: new TestCamera(),
        scene,
        mesh,
        lights: [],
      };

      expect(context.scene).toBe(scene);
      expect(context.scene?.children.length).toBeGreaterThan(0);
    });

    it("should have mesh of type Mesh", () => {
      const geometry = new BoxGeometry();
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);
      mesh.position.set(5, 10, 15);

      const context: RenderContext = {
        camera: new TestCamera(),
        scene: new Scene(),
        mesh,
        lights: [],
      };

      expect(context.mesh).toBe(mesh);
      expect(context.mesh?.position.x).toBe(5);
      expect(context.mesh?.material).toBe(material);
    });

    it("should have lights array", () => {
      const light1 = new PointLight();
      const light2 = new PointLight();
      light1.position.set(10, 10, 10);
      light2.position.set(-10, 10, -10);

      const context: RenderContext = {
        camera: new TestCamera(),
        lights: [light1, light2],
      };

      expect(Array.isArray(context.lights)).toBe(true);
      expect(context.lights.length).toBe(2);
      expect(context.lights[0]).toBe(light1);
      expect(context.lights[1]).toBe(light2);
    });

    it("should allow empty lights array", () => {
      const context: RenderContext = {
        camera: new TestCamera(),
        lights: [],
      };

      expect(context.lights).toBeDefined();
      expect(context.lights.length).toBe(0);
    });
  });

  describe("Primitive topology values", () => {
    it("should return valid GPUPrimitiveTopology", () => {
      const material = new BasicMaterial();
      const topology = material.getPrimitiveTopology();

      const validTopologies = [
        "point-list",
        "line-list",
        "line-strip",
        "triangle-list",
        "triangle-strip",
      ];

      expect(validTopologies.includes(topology)).toBe(true);
    });

    it("should return triangle-list for basic material", () => {
      const material = new BasicMaterial();
      expect(material.getPrimitiveTopology()).toBe("triangle-list");
    });
  });

  describe("Uniform buffer size constraints", () => {
    it("should be at least 64 bytes for MVP matrix", () => {
      const material = new BasicMaterial();
      const size = material.getUniformBufferSize();

      expect(size).toBeGreaterThanOrEqual(64);
    });

    it("should be aligned to proper boundaries", () => {
      const material = new BasicMaterial();
      const size = material.getUniformBufferSize();

      // WebGPU uniform buffers should be aligned to 16 bytes
      expect(size % 16).toBe(0);
    });

    it("should match actual uniform data size", () => {
      const material = new BasicMaterial();
      const size = material.getUniformBufferSize();

      // BasicMaterial: mat4x4f (64) + vec4f color (16) = 80 bytes
      expect(size).toBe(80);
    });
  });

  describe("Type uniqueness", () => {
    it("should have consistent type across instances", () => {
      const material1 = new BasicMaterial();
      const material2 = new BasicMaterial();

      expect(material1.type).toBe(material2.type);
    });

    it("should have different types for different materials", () => {
      const basicMaterial = new BasicMaterial();
      const shaderMaterial = new ShaderMaterial({
        vertexShader:
          "@vertex fn main() -> @builtin(position) vec4f { return vec4f(0.0); }",
        fragmentShader:
          "@fragment fn main() -> @location(0) vec4f { return vec4f(1.0); }",
      });

      expect(basicMaterial.type).not.toBe(shaderMaterial.type);
    });
  });

  describe("Shader code validation", () => {
    it("should return non-empty vertex shader", () => {
      const material = new BasicMaterial();
      const shader = material.getVertexShader();

      expect(shader.trim().length).toBeGreaterThan(0);
      expect(typeof shader).toBe("string");
    });

    it("should return non-empty fragment shader", () => {
      const material = new BasicMaterial();
      const shader = material.getFragmentShader();

      expect(shader.trim().length).toBeGreaterThan(0);
      expect(typeof shader).toBe("string");
    });

    it("should have consistent shader output across calls", () => {
      const material = new BasicMaterial();
      const vertex1 = material.getVertexShader();
      const vertex2 = material.getVertexShader();
      const fragment1 = material.getFragmentShader();
      const fragment2 = material.getFragmentShader();

      expect(vertex1).toBe(vertex2);
      expect(fragment1).toBe(fragment2);
    });

    it("should return valid WGSL shader code for ShaderMaterial", () => {
      const vertexShader = `
        @vertex
        fn main(@location(0) position: vec3f) -> @builtin(position) vec4f {
          return vec4f(position, 1.0);
        }
      `;
      const fragmentShader = `
        @fragment
        fn main() -> @location(0) vec4f {
          return vec4f(1.0, 0.0, 0.0, 1.0);
        }
      `;

      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
      });

      expect(material.getVertexShader()).toContain("@vertex");
      expect(material.getFragmentShader()).toContain("@fragment");
    });
  });
});
