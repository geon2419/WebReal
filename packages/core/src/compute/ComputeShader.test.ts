import { describe, it, expect, beforeAll } from "bun:test";
import { ComputeShader } from "./ComputeShader";
import { ComputeShaderError } from "./ComputeShaderError";

// Define WebGPU constants for test environment (not available in Bun/Node.js)
beforeAll(() => {
  if (typeof GPUShaderStage === "undefined") {
    (globalThis as any).GPUShaderStage = {
      VERTEX: 0x1,
      FRAGMENT: 0x2,
      COMPUTE: 0x4,
    };
  }
});

const SIMPLE_SHADER = `
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;
  
  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3u) {
    data[id.x] *= 2.0;
  }
`;

// Mock GPUDevice
function createMockDevice(): GPUDevice {
  const bindGroupLayouts: GPUBindGroupLayout[] = [];
  const pipelines: GPUComputePipeline[] = [];

  return {
    createShaderModule: (descriptor: GPUShaderModuleDescriptor) => ({
      label: descriptor.label,
      getCompilationInfo: async () => ({ messages: [] }),
    }),
    createBindGroupLayout: (descriptor: GPUBindGroupLayoutDescriptor) => {
      const layout = { label: descriptor.label } as GPUBindGroupLayout;
      bindGroupLayouts.push(layout);
      return layout;
    },
    createPipelineLayout: (descriptor: GPUPipelineLayoutDescriptor) => ({
      label: descriptor.label,
    }),
    createComputePipeline: (descriptor: GPUComputePipelineDescriptor) => {
      const pipeline = {
        label: descriptor.label,
        descriptor,
        getBindGroupLayout: (index: number) => bindGroupLayouts[index],
      } as GPUComputePipeline;
      pipelines.push(pipeline);
      return pipeline;
    },
    createBindGroup: (descriptor: GPUBindGroupDescriptor) => ({
      label: descriptor.label,
    }),
  } as unknown as GPUDevice;
}

describe("ComputeShader", () => {
  describe("constructor", () => {
    it("should throw if device is not provided", () => {
      expect(() => {
        new ComputeShader(null as unknown as GPUDevice, {
          code: SIMPLE_SHADER,
        });
      }).toThrow(ComputeShaderError);
    });

    it("should throw if shader code is empty", () => {
      const mockDevice = createMockDevice();
      expect(() => {
        new ComputeShader(mockDevice, { code: "" });
      }).toThrow(ComputeShaderError);
    });

    it("should throw if shader code is only whitespace", () => {
      const mockDevice = createMockDevice();
      expect(() => {
        new ComputeShader(mockDevice, { code: "   \n\t  " });
      }).toThrow(ComputeShaderError);
    });

    it("should create shader with valid code", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, { code: SIMPLE_SHADER });

      expect(shader.code).toBe(SIMPLE_SHADER);
    });
  });

  describe("entryPoint", () => {
    it("should default to 'main'", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, { code: SIMPLE_SHADER });

      expect(shader.entryPoint).toBe("main");
    });

    it("should use custom entry point when specified", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        entryPoint: "computeMain",
      });

      expect(shader.entryPoint).toBe("computeMain");
    });
  });

  describe("hasExplicitLayout", () => {
    it("should return false when no bind group layouts provided", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, { code: SIMPLE_SHADER });

      expect(shader.hasExplicitLayout).toBe(false);
    });

    it("should return true when bind group layouts are provided", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        bindGroupLayouts: [
          {
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" },
              },
            ],
          },
        ],
      });

      expect(shader.hasExplicitLayout).toBe(true);
    });
  });

  describe("bindGroupLayouts", () => {
    it("should create bind group layouts from descriptors", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        label: "TestShader",
        bindGroupLayouts: [
          {
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" },
              },
            ],
          },
          {
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform" },
              },
            ],
          },
        ],
      });

      // Should have created 2 bind group layouts
      const layout0 = shader.getBindGroupLayout(0);
      const layout1 = shader.getBindGroupLayout(1);

      expect(layout0).toBeDefined();
      expect(layout1).toBeDefined();
    });

    it("should handle empty bind group layouts array", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        bindGroupLayouts: [],
      });

      expect(shader.hasExplicitLayout).toBe(false);
    });
  });

  describe("getPipeline", () => {
    it("should create and return a pipeline", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, { code: SIMPLE_SHADER });

      const pipeline = shader.getPipeline();
      expect(pipeline).toBeDefined();
    });

    it("should return the same pipeline on subsequent calls", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, { code: SIMPLE_SHADER });

      const pipeline1 = shader.getPipeline();
      const pipeline2 = shader.getPipeline();

      expect(pipeline1).toBe(pipeline2);
    });

    it("should use pipeline cache by default for auto layout", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        useCache: true,
      });

      const pipeline = shader.getPipeline();
      expect(pipeline).toBeDefined();
    });

    it("should not use cache when useCache is false", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        useCache: false,
      });

      const pipeline = shader.getPipeline();
      expect(pipeline).toBeDefined();
    });

    it("should respect custom entry point when caching is enabled", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        entryPoint: "computeMain",
        useCache: true,
      });

      const pipeline = shader.getPipeline();
      expect((pipeline as any).descriptor.compute.entryPoint).toBe(
        "computeMain",
      );
    });
  });

  describe("createBindGroup", () => {
    it("should create bind group with explicit layout", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        bindGroupLayouts: [
          {
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" },
              },
            ],
          },
        ],
      });

      const mockBuffer = {} as GPUBuffer;
      const bindGroup = shader.createBindGroup(
        0,
        [{ binding: 0, resource: { buffer: mockBuffer } }],
        "TestBindGroup",
      );

      expect(bindGroup).toBeDefined();
    });
  });

  describe("label", () => {
    it("should use label in pipeline creation", () => {
      const mockDevice = createMockDevice();
      const shader = new ComputeShader(mockDevice, {
        code: SIMPLE_SHADER,
        label: "MyComputeShader",
      });

      const pipeline = shader.getPipeline();
      expect((pipeline as any).label).toContain("MyComputeShader");
    });
  });
});
