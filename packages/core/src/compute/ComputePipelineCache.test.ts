import { describe, it, expect } from "bun:test";
import { ComputePipelineCache } from "./ComputePipelineCache";

describe("ComputePipelineCache", () => {
  describe("getHashCode", () => {
    it("should generate consistent hash for the same string", () => {
      const code = "@compute fn main() {}";
      const hash1 = ComputePipelineCache.getHashCode(code);
      const hash2 = ComputePipelineCache.getHashCode(code);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different strings", () => {
      const hash1 = ComputePipelineCache.getHashCode("@compute fn main() {}");
      const hash2 = ComputePipelineCache.getHashCode("@compute fn other() {}");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty strings", () => {
      const hash = ComputePipelineCache.getHashCode("");
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should handle long strings", () => {
      const longCode = "a".repeat(10000);
      const hash = ComputePipelineCache.getHashCode(longCode);

      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should return base36 encoded string", () => {
      const hash = ComputePipelineCache.getHashCode("test");
      // Base36 characters are 0-9 and a-z
      expect(hash).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe("has", () => {
    it("should return false for uncached shader", () => {
      const mockDevice = {} as GPUDevice;
      const shaderCode = "@compute fn uncached() {}";

      expect(ComputePipelineCache.has(mockDevice, shaderCode)).toBe(false);
    });
  });

  describe("clear", () => {
    it("should not throw when clearing non-existent device cache", () => {
      const mockDevice = {} as GPUDevice;

      expect(() => {
        ComputePipelineCache.clear(mockDevice);
      }).not.toThrow();
    });
  });

  // Note: getOrCreate tests require actual GPUDevice and would be integration tests
  // The following tests verify caching behavior using a mocked GPUDevice

  describe("getOrCreate", () => {
    it("should cache pipelines when layout is auto", () => {
      let createPipelineCalls = 0;
      const mockDevice = {
        createShaderModule: (descriptor: any) => ({ descriptor }),
        createComputePipeline: (descriptor: any) => {
          createPipelineCalls++;
          return { descriptor, id: createPipelineCalls };
        },
      } as unknown as GPUDevice;

      ComputePipelineCache.clear(mockDevice);

      const shaderCode = "@compute fn main() {}";
      const pipeline1 = ComputePipelineCache.getOrCreate(
        mockDevice,
        shaderCode,
        "auto",
        "Test"
      );
      const pipeline2 = ComputePipelineCache.getOrCreate(
        mockDevice,
        shaderCode,
        "auto",
        "Test"
      );

      expect(pipeline1).toBe(pipeline2);
      expect(createPipelineCalls).toBe(1);
      expect(ComputePipelineCache.has(mockDevice, shaderCode)).toBe(true);
    });

    it("should not cache pipelines when layout is explicit", () => {
      let createPipelineCalls = 0;
      const mockDevice = {
        createShaderModule: (descriptor: any) => ({ descriptor }),
        createComputePipeline: (descriptor: any) => {
          createPipelineCalls++;
          return { descriptor, id: createPipelineCalls };
        },
      } as unknown as GPUDevice;

      ComputePipelineCache.clear(mockDevice);

      const shaderCode = "@compute fn main() {}";
      const explicitLayout = {} as GPUPipelineLayout;

      const pipeline1 = ComputePipelineCache.getOrCreate(
        mockDevice,
        shaderCode,
        explicitLayout,
        "Test"
      );
      const pipeline2 = ComputePipelineCache.getOrCreate(
        mockDevice,
        shaderCode,
        explicitLayout,
        "Test"
      );

      expect(pipeline1).not.toBe(pipeline2);
      expect(createPipelineCalls).toBe(2);
      // Explicit-layout pipelines should not populate the cache used by has().
      expect(ComputePipelineCache.has(mockDevice, shaderCode)).toBe(false);
    });
  });

  describe("cache key generation", () => {
    it("should generate unique keys for shaders with whitespace differences", () => {
      const code1 = "@compute fn main() {}";
      const code2 = "@compute  fn  main()  {}";

      const hash1 = ComputePipelineCache.getHashCode(code1);
      const hash2 = ComputePipelineCache.getHashCode(code2);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate same key for identical shaders", () => {
      const code = `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;
        
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) id: vec3u) {
          data[id.x] *= 2.0;
        }
      `;

      const hash1 = ComputePipelineCache.getHashCode(code);
      const hash2 = ComputePipelineCache.getHashCode(code);

      expect(hash1).toBe(hash2);
    });
  });
});
