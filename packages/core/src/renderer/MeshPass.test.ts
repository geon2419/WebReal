import { describe, it, expect, mock } from "bun:test";
import { MeshPass } from "./MeshPass";
import type { Material } from "../material/Material";
import { Matrix4 } from "@web-real/math";

describe("MeshPass", () => {
  describe("render", () => {
    it("should throw error when material uniformDataOffset is less than 64", () => {
      // Arrange
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockMeshResources = createMockMeshResourceCache();

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const mockMaterial: Partial<Material> = {
        writeUniformData: mock(() => {}),
        getUniformBufferSize: () => 128,
        getUniformDataOffset: () => 32, // Invalid: less than 64
      };

      const mockMesh = createMockMesh(mockMaterial as Material);
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();

      // Act & Assert
      expect(() => {
        meshPass.render({
          passEncoder: mockPassEncoder,
          meshes: [mockMesh],
          lights: [],
          scene: {} as any,
          camera: mockCamera,
        });
      }).toThrow("Material.getUniformDataOffset() must be >= 64 (got 32)");
    });

    it("should use indexed draw when indexCount is greater than 0", () => {
      // Arrange
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockResources = {
        uniformBuffer: {} as GPUBuffer,
        bindGroup: {} as GPUBindGroup,
        vertexBuffer: {} as GPUBuffer,
        indexBuffer: {} as GPUBuffer,
        indexFormat: "uint16" as GPUIndexFormat,
        indexCount: 36,
        iblBindGroup: null,
        instanceCount: 1,
      };
      const mockMeshResources = createMockMeshResourceCache(mockResources);

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const mockMesh = createMockMesh();
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();

      // Act
      meshPass.render({
        passEncoder: mockPassEncoder,
        meshes: [mockMesh],
        lights: [],
        scene: {} as any,
        camera: mockCamera,
      });

      // Assert
      expect(mockPassEncoder.setIndexBuffer).toHaveBeenCalledWith(
        mockResources.indexBuffer,
        mockResources.indexFormat,
      );
      expect(mockPassEncoder.drawIndexed).toHaveBeenCalledWith(36, 1);
      expect(mockPassEncoder.draw).not.toHaveBeenCalled();
    });

    it("should use non-indexed draw when indexCount is 0", () => {
      // Arrange
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockResources = {
        uniformBuffer: {} as GPUBuffer,
        bindGroup: {} as GPUBindGroup,
        vertexBuffer: {} as GPUBuffer,
        indexBuffer: {} as GPUBuffer,
        indexFormat: "uint16" as GPUIndexFormat,
        indexCount: 0,
        iblBindGroup: null,
        instanceCount: 1,
      };
      const mockMeshResources = createMockMeshResourceCache(mockResources);

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const mockMesh = createMockMesh();
      mockMesh.vertexCount = 24;
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();

      // Act
      meshPass.render({
        passEncoder: mockPassEncoder,
        meshes: [mockMesh],
        lights: [],
        scene: {} as any,
        camera: mockCamera,
      });

      // Assert
      expect(mockPassEncoder.setIndexBuffer).not.toHaveBeenCalled();
      expect(mockPassEncoder.drawIndexed).not.toHaveBeenCalled();
      expect(mockPassEncoder.draw).toHaveBeenCalledWith(24, 1);
    });

    it("should set IBL bind group when present", () => {
      // Arrange
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockIBLBindGroup = {} as GPUBindGroup;
      const mockResources = {
        uniformBuffer: {} as GPUBuffer,
        bindGroup: {} as GPUBindGroup,
        vertexBuffer: {} as GPUBuffer,
        indexBuffer: {} as GPUBuffer,
        indexFormat: "uint16" as GPUIndexFormat,
        indexCount: 0,
        iblBindGroup: mockIBLBindGroup,
        instanceCount: 1,
      };
      const mockMeshResources = createMockMeshResourceCache(mockResources);

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const mockMesh = createMockMesh();
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();

      // Act
      meshPass.render({
        passEncoder: mockPassEncoder,
        meshes: [mockMesh],
        lights: [],
        scene: {} as any,
        camera: mockCamera,
      });

      // Assert
      expect(mockPassEncoder.setBindGroup).toHaveBeenCalledWith(
        1,
        mockIBLBindGroup,
      );
    });

    it("should not set IBL bind group when absent", () => {
      // Arrange
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockResources = {
        uniformBuffer: {} as GPUBuffer,
        bindGroup: {} as GPUBindGroup,
        vertexBuffer: {} as GPUBuffer,
        indexBuffer: {} as GPUBuffer,
        indexFormat: "uint16" as GPUIndexFormat,
        indexCount: 0,
        iblBindGroup: null,
        instanceCount: 1,
      };
      const mockMeshResources = createMockMeshResourceCache(mockResources);

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const mockMesh = createMockMesh();
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();

      // Act
      meshPass.render({
        passEncoder: mockPassEncoder,
        meshes: [mockMesh],
        lights: [],
        scene: {} as any,
        camera: mockCamera,
      });

      // Assert
      const setBindGroupCalls = (mockPassEncoder.setBindGroup as any).mock
        .calls;
      expect(setBindGroupCalls.length).toBe(1); // Only group 0 should be set
      expect(setBindGroupCalls[0][0]).toBe(0);
    });

    it("should set instance bind group when present", () => {
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockInstanceBindGroup = {} as GPUBindGroup;
      const mockResources = {
        uniformBuffer: {} as GPUBuffer,
        bindGroup: {} as GPUBindGroup,
        vertexBuffer: {} as GPUBuffer,
        indexBuffer: {} as GPUBuffer,
        indexFormat: "uint16" as GPUIndexFormat,
        indexCount: 0,
        iblBindGroup: null,
        instanceBindGroup: mockInstanceBindGroup,
        instanceCount: 2,
      };
      const mockMeshResources = createMockMeshResourceCache(mockResources);

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const mockMesh = createMockMesh();
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();

      meshPass.render({
        passEncoder: mockPassEncoder,
        meshes: [mockMesh],
        lights: [],
        scene: {} as any,
        camera: mockCamera,
      });

      expect(mockPassEncoder.setBindGroup).toHaveBeenCalledWith(
        2,
        mockInstanceBindGroup,
      );
    });

    it("should write custom uniform data when material provides writeUniformData", () => {
      // Arrange
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockMeshResources = createMockMeshResourceCache();

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const writeUniformDataMock = mock(
        (dataView: DataView, offset: number) => {
          // Simulate writing some data
          dataView.setFloat32(offset, 1.0, true);
        },
      );

      const mockMaterial: Partial<Material> = {
        writeUniformData: writeUniformDataMock,
        getUniformBufferSize: () => 128,
        getUniformDataOffset: () => 64,
      };

      const mockMesh = createMockMesh(mockMaterial as Material);
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();
      const mockScene = {} as any;
      const mockLights: any[] = [];

      // Act
      meshPass.render({
        passEncoder: mockPassEncoder,
        meshes: [mockMesh],
        lights: mockLights,
        scene: mockScene,
        camera: mockCamera,
      });

      // Assert
      expect(writeUniformDataMock).toHaveBeenCalledWith(
        expect.any(DataView),
        64,
        expect.objectContaining({
          camera: mockCamera,
          scene: mockScene,
          mesh: mockMesh,
          lights: mockLights,
        }),
      );

      // Verify custom data buffer was written (size = 128 - 64 = 64 bytes)
      const queueWriteCalls = (mockDevice.queue.writeBuffer as any).mock.calls;
      const customDataWrite = queueWriteCalls.find(
        (call: any) => call[1] === 64,
      );
      expect(customDataWrite).toBeDefined();
      expect(customDataWrite[4]).toBe(64); // customDataSize
    });

    it("should not write custom uniform data when customDataSize is 0", () => {
      // Arrange
      const mockDevice = createMockDevice();
      const mockPipelines = createMockPipelineCache();
      const mockMeshResources = createMockMeshResourceCache();

      const meshPass = new MeshPass({
        device: mockDevice,
        pipelines: mockPipelines,
        meshResources: mockMeshResources,
      });

      const mockMaterial: Partial<Material> = {
        writeUniformData: mock(() => {}),
        getUniformBufferSize: () => 64, // Same as offset, so customDataSize = 0
        getUniformDataOffset: () => 64,
      };

      const mockMesh = createMockMesh(mockMaterial as Material);
      const mockCamera = createMockCamera();
      const mockPassEncoder = createMockPassEncoder();

      // Act
      meshPass.render({
        passEncoder: mockPassEncoder,
        meshes: [mockMesh],
        lights: [],
        scene: {} as any,
        camera: mockCamera,
      });

      // Assert - only MVP matrix write should occur (offset 0), not custom data
      const queueWriteCalls = (mockDevice.queue.writeBuffer as any).mock.calls;
      expect(queueWriteCalls.length).toBe(1);
      expect(queueWriteCalls[0][1]).toBe(0); // MVP matrix offset
    });
  });
});

// Mock helper functions
function createMockDevice(): GPUDevice {
  return {
    queue: {
      writeBuffer: mock(() => {}),
    },
  } as any;
}

function createMockPipelineCache(): any {
  return {
    getOrCreate: mock(() => ({}) as GPURenderPipeline),
  };
}

function createMockMeshResourceCache(resources?: any): any {
  return {
    getOrCreate: mock(() => {
      return (
        resources || {
          uniformBuffer: {} as GPUBuffer,
          bindGroup: {} as GPUBindGroup,
          vertexBuffer: {} as GPUBuffer,
          indexBuffer: {} as GPUBuffer,
          indexFormat: "uint16" as GPUIndexFormat,
          indexCount: 0,
          iblBindGroup: null,
          instanceCount: 1,
        }
      );
    }),
  };
}

function createMockMesh(material?: Material): any {
  return {
    material: material || ({} as Material),
    worldMatrix: new Matrix4(),
    vertexCount: 3,
  };
}

function createMockCamera(): any {
  return {
    projectionMatrix: new Matrix4(),
    viewMatrix: new Matrix4(),
  };
}

function createMockPassEncoder(): any {
  return {
    setPipeline: mock(() => {}),
    setBindGroup: mock(() => {}),
    setVertexBuffer: mock(() => {}),
    setIndexBuffer: mock(() => {}),
    draw: mock(() => {}),
    drawIndexed: mock(() => {}),
  };
}
