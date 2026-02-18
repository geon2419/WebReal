import { describe, it, expect, beforeEach, mock } from "bun:test";
import { PipelineCache } from "./PipelineCache";
import type { Material } from "../material/Material";

describe("PipelineCache", () => {
  let mockDevice: GPUDevice;
  let mockPipeline: GPURenderPipeline;

  beforeEach(() => {
    mockPipeline = {} as GPURenderPipeline;

    mockDevice = {
      createShaderModule: mock(() => ({}) as GPUShaderModule),
      createRenderPipeline: mock(() => mockPipeline),
    } as unknown as GPUDevice;
  });

  describe("getOrCreate", () => {
    it("should create a new pipeline for a material", () => {
      const cache = new PipelineCache({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
      });

      const mockMaterial: Material = {
        type: "test-material",
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "// vertex shader",
        getFragmentShader: () => "// fragment shader",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const pipeline = cache.getOrCreate(mockMaterial);

      expect(pipeline).toBe(mockPipeline);
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
    });

    it("should return cached pipeline for same material type and topology", () => {
      const cache = new PipelineCache({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
      });

      const mockMaterial: Material = {
        type: "test-material",
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "// vertex shader",
        getFragmentShader: () => "// fragment shader",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const pipeline1 = cache.getOrCreate(mockMaterial);
      const pipeline2 = cache.getOrCreate(mockMaterial);

      expect(pipeline1).toBe(pipeline2);
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
    });

    it("should create separate pipelines for different topologies", () => {
      const cache = new PipelineCache({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
      });

      const mockMaterial1: Material = {
        type: "test-material",
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "// vertex shader",
        getFragmentShader: () => "// fragment shader",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const mockMaterial2: Material = {
        ...mockMaterial1,
        getPrimitiveTopology: () => "line-list",
      };

      const pipeline1 = cache.getOrCreate(mockMaterial1);
      const pipeline2 = cache.getOrCreate(mockMaterial2);

      expect(pipeline1).toBe(mockPipeline);
      expect(pipeline2).toBe(mockPipeline);
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(2);
    });

    it("should create separate pipelines for different material types", () => {
      const cache = new PipelineCache({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
      });

      const mockMaterial1: Material = {
        type: "material-A",
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "// vertex shader",
        getFragmentShader: () => "// fragment shader",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const mockMaterial2: Material = {
        ...mockMaterial1,
        type: "material-B",
      };

      cache.getOrCreate(mockMaterial1);
      cache.getOrCreate(mockMaterial2);

      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(2);
    });

    it("should generate correct cache key from material type and topology", () => {
      const cache = new PipelineCache({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
      });

      const mockMaterial: Material = {
        type: "pbr-material",
        getPrimitiveTopology: () => "triangle-strip",
        getVertexShader: () => "// vertex shader",
        getFragmentShader: () => "// fragment shader",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      cache.getOrCreate(mockMaterial);
      cache.getOrCreate(mockMaterial);

      // Should use cache (key: "pbr-material_triangle-strip")
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe("clear", () => {
    it("should clear all cached pipelines", () => {
      const cache = new PipelineCache({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
      });

      const mockMaterial: Material = {
        type: "test-material",
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "// vertex shader",
        getFragmentShader: () => "// fragment shader",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      cache.getOrCreate(mockMaterial);
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);

      cache.clear();

      // After clear, should create a new pipeline
      cache.getOrCreate(mockMaterial);
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(2);
    });
  });
});
