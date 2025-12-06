import { describe, it, expect } from "vitest";
import { ShaderMaterial } from "./ShaderMaterial";

describe("ShaderMaterial", () => {
  const simpleVertexShader = `
    struct Uniforms {
      mvpMatrix: mat4x4f,
    }
    @group(0) @binding(0) var<uniform> uniforms: Uniforms;
    
    @vertex
    fn main(@location(0) position: vec3f) -> @builtin(position) vec4f {
      return uniforms.mvpMatrix * vec4f(position, 1.0);
    }
  `;

  const simpleFragmentShader = `
    @fragment
    fn main() -> @location(0) vec4f {
      return vec4f(1.0, 0.0, 0.0, 1.0);
    }
  `;

  describe("type generation", () => {
    it("should generate consistent type for identical shaders", () => {
      const material1 = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      const material2 = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      expect(material1.type).toBe(material2.type);
    });

    it("should generate different types for different shaders", () => {
      const material1 = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      const material2 = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: `
          @fragment
          fn main() -> @location(0) vec4f {
            return vec4f(0.0, 1.0, 0.0, 1.0); // Different color!
          }
        `,
      });

      expect(material1.type).not.toBe(material2.type);
    });

    it("should generate type starting with 'shader_'", () => {
      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      expect(material.type).toMatch(/^shader_/);
    });
  });

  describe("uniformBufferSize validation", () => {
    it("should throw error if uniformBufferSize < 64", () => {
      expect(() => {
        new ShaderMaterial({
          vertexShader: simpleVertexShader,
          fragmentShader: simpleFragmentShader,
          uniformBufferSize: 32,
        });
      }).toThrow("uniformBufferSize must be at least 64 bytes");
    });

    it("should accept uniformBufferSize >= 64", () => {
      expect(() => {
        new ShaderMaterial({
          vertexShader: simpleVertexShader,
          fragmentShader: simpleFragmentShader,
          uniformBufferSize: 64,
        });
      }).not.toThrow();

      expect(() => {
        new ShaderMaterial({
          vertexShader: simpleVertexShader,
          fragmentShader: simpleFragmentShader,
          uniformBufferSize: 128,
        });
      }).not.toThrow();
    });

    it("should use default uniformBufferSize of 80", () => {
      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      expect(material.getUniformBufferSize()).toBe(80);
    });
  });

  describe("shader getters", () => {
    it("should return provided vertex shader", () => {
      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      expect(material.getVertexShader()).toBe(simpleVertexShader);
    });

    it("should return provided fragment shader", () => {
      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      expect(material.getFragmentShader()).toBe(simpleFragmentShader);
    });
  });

  describe("writeUniformData callback", () => {
    it("should call the callback when writeUniformData is invoked", () => {
      let called = false;
      const callback = (buffer: DataView, offset?: number) => {
        called = true;
        expect(offset).toBe(64); // default offset
        buffer.setFloat32(offset ?? 64, 1.0, true);
      };

      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
        writeUniformData: callback,
      });

      const buffer = new DataView(new ArrayBuffer(80));
      material.writeUniformData(buffer, 64);

      expect(called).toBe(true);
      expect(buffer.getFloat32(64, true)).toBe(1.0);
    });

    it("should not throw if writeUniformData is called without a callback", () => {
      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      const buffer = new DataView(new ArrayBuffer(80));
      expect(() => material.writeUniformData(buffer, 64)).not.toThrow();
    });
  });

  describe("topology", () => {
    it("should use triangle-list by default", () => {
      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
      });

      expect(material.getPrimitiveTopology()).toBe("triangle-list");
    });

    it("should use provided topology", () => {
      const material = new ShaderMaterial({
        vertexShader: simpleVertexShader,
        fragmentShader: simpleFragmentShader,
        primitiveTopology: "line-list",
      });

      expect(material.getPrimitiveTopology()).toBe("line-list");
    });
  });
});
