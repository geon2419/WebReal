import { describe, it, expect, beforeEach, mock } from "bun:test";
import { MeshResourceCache } from "./MeshResourceCache";
import { FallbackResources } from "./FallbackResources";
import { Mesh } from "../scene/Mesh";
import { InstancedMesh } from "../scene/InstancedMesh";
import type { Material } from "../material/Material";
import { BoxGeometry } from "../geometry/BoxGeometry";

// Mock WebGPU constants for test environment
if (typeof globalThis.GPUBufferUsage === "undefined") {
  (globalThis as any).GPUBufferUsage = {
    VERTEX: 0x0020,
    INDEX: 0x0010,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    COPY_DST: 0x0008,
  };
}

describe("MeshResourceCache", () => {
  let mockDevice: GPUDevice;
  let mockFallback: FallbackResources;
  let mockBuffer: GPUBuffer;
  let mockBindGroup: GPUBindGroup;
  let mockPipeline: GPURenderPipeline;
  let mockQueue: GPUQueue;

  beforeEach(() => {
    mockBuffer = { destroy: mock(() => {}) } as unknown as GPUBuffer;
    mockBindGroup = {} as GPUBindGroup;

    mockQueue = {
      writeBuffer: mock(() => {}),
    } as unknown as GPUQueue;

    mockPipeline = {
      getBindGroupLayout: mock(
        (index: number) =>
          ({
            label: `Bind Group Layout ${index}`,
          } as GPUBindGroupLayout)
      ),
    } as unknown as GPURenderPipeline;

    mockDevice = {
      createBuffer: mock(() => mockBuffer),
      createBindGroup: mock(() => mockBindGroup),
      queue: mockQueue,
    } as unknown as GPUDevice;

    mockFallback = {
      getDummyCubeTexture: mock(() => ({
        createView: () => ({} as GPUTextureView),
      })),
      getDummyBrdfLUT: mock(() => ({
        createView: () => ({} as GPUTextureView),
      })),
      getLinearSampler: mock(() => ({} as GPUSampler)),
    } as unknown as FallbackResources;
  });

  describe("getOrCreate", () => {
    it("should create GPU resources for a new mesh", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "// vertex",
        getFragmentShader: () => "// fragment",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      const resources = cache.getOrCreate(mesh, mockPipeline);

      expect(resources).toBeDefined();
      expect(resources.vertexBuffer).toBe(mockBuffer);
      expect(resources.indexBuffer).toBe(mockBuffer);
      expect(resources.uniformBuffer).toBe(mockBuffer);
      expect(resources.bindGroup).toBe(mockBindGroup);
      expect(resources.materialType).toBe("test-material");
      expect(resources.topology).toBe("triangle-list");
      expect(resources.bindingRevision).toBe(0);

      // Should create 3 buffers: vertex, index, uniform
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(3);
      expect(mockDevice.createBindGroup).toHaveBeenCalledTimes(1);
    });

    it("should create a separate bind group for InstancedMesh storage", () => {
      const meshBindGroup = {} as GPUBindGroup;
      const instanceBindGroup = {} as GPUBindGroup;
      let bindGroupCreateCount = 0;
      mockDevice.createBindGroup = mock(() => {
        bindGroupCreateCount++;
        return bindGroupCreateCount === 1 ? meshBindGroup : instanceBindGroup;
      }) as unknown as any;

      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new InstancedMesh(geometry, mockMaterial, 3, {
        mode: "position",
      });

      const resources = cache.getOrCreate(mesh, mockPipeline);

      expect(resources.bindGroup).toBe(meshBindGroup);
      expect(resources.instanceBindGroup).toBe(instanceBindGroup);
      expect(mockDevice.createBindGroup).toHaveBeenCalledTimes(2);
      expect(mockPipeline.getBindGroupLayout).toHaveBeenCalledWith(0);
      expect(mockPipeline.getBindGroupLayout).toHaveBeenCalledWith(2);
    });

    it("should not create zero-sized index buffers for non-indexed meshes", () => {
      // Simulate WebGPU validation: buffer size must be > 0 and aligned to 4 bytes.
      mockDevice.createBuffer = mock((descriptor: GPUBufferDescriptor) => {
        if (descriptor.size <= 0) {
          throw new Error("GPUBufferDescriptor.size must be > 0");
        }
        if (descriptor.size % 4 !== 0) {
          throw new Error("GPUBufferDescriptor.size must be 4-byte aligned");
        }
        return mockBuffer;
      }) as unknown as any;

      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "basic",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 24,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        indices: new Uint16Array(0),
        vertexCount: 3,
        indexCount: 0,
      } as any;

      const mesh = new Mesh(geometry, mockMaterial);

      expect(() => cache.getOrCreate(mesh, mockPipeline)).not.toThrow();

      const calls = (mockDevice.createBuffer as any).mock.calls as any[];
      // 0: vertex buffer, 1: index buffer, 2: uniform buffer
      expect(calls.length).toBe(3);
      expect(calls[1][0].label).toBe("Mesh Index Buffer");
      expect(calls[1][0].size).toBeGreaterThanOrEqual(4);
      expect(calls[1][0].size % 4).toBe(0);
    });

    it("should return cached resources for the same mesh", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      const resources1 = cache.getOrCreate(mesh, mockPipeline);
      const resources2 = cache.getOrCreate(mesh, mockPipeline);

      expect(resources1).toBe(resources2);
      // Should only create buffers once
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(3);
    });

    it("should recreate resources when material type changes", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial1: Material = {
        type: "material-A",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial1);

      cache.getOrCreate(mesh, mockPipeline);

      // Change material
      const mockMaterial2: Material = {
        ...mockMaterial1,
        type: "material-B",
      };
      mesh.material = mockMaterial2;

      cache.getOrCreate(mesh, mockPipeline);

      // Should destroy old buffers and create new ones
      expect(mockBuffer.destroy).toHaveBeenCalledTimes(3);
      // 3 buffers first time + 3 buffers second time = 6
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(6);
    });

    it("should recreate resources when topology changes", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      let currentTopology: GPUPrimitiveTopology = "triangle-list";

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => currentTopology,
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      cache.getOrCreate(mesh, mockPipeline);

      // Change topology
      currentTopology = "line-list";

      cache.getOrCreate(mesh, mockPipeline);

      // Should destroy old and create new
      expect(mockBuffer.destroy).toHaveBeenCalledTimes(3);
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(6);
    });

    it("should recreate resources when needsUpdate is true", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      cache.getOrCreate(mesh, mockPipeline);

      // Mark mesh as needing update
      mesh.needsUpdate = true;

      cache.getOrCreate(mesh, mockPipeline);

      // Should destroy old and create new
      expect(mockBuffer.destroy).toHaveBeenCalledTimes(3);
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(6);
      // needsUpdate should be reset
      expect(mesh.needsUpdate).toBe(false);
    });

    it("should refresh cached vertex data when geometry mutates and needsUpdate is set", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "line",
        bindingRevision: 0,
        getPrimitiveTopology: () => "line-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 12,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      cache.getOrCreate(mesh, mockPipeline);
      const firstVertexData = (mockQueue.writeBuffer as any).mock.calls[0][2] as Float32Array;

      geometry.positions[0] = geometry.positions[0] + 123.0;
      mesh.needsUpdate = true;

      cache.getOrCreate(mesh, mockPipeline);
      const secondVertexData = (mockQueue.writeBuffer as any).mock.calls[2][2] as Float32Array;

      expect(secondVertexData[0]).not.toBe(firstVertexData[0]);
    });

    it("should update only bindGroup when bindingRevision changes", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      let bindingRevision = 0;

      const mockMaterial: Material = {
        type: "test-material",
        get bindingRevision() {
          return bindingRevision;
        },
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      cache.getOrCreate(mesh, mockPipeline);
      const initialCreateBufferCalls = 3;

      // Change bindingRevision
      bindingRevision = 1;

      cache.getOrCreate(mesh, mockPipeline);

      // Should NOT create new buffers
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(
        initialCreateBufferCalls
      );
      // Should create new bindGroup
      expect(mockDevice.createBindGroup).toHaveBeenCalledTimes(2);
    });

    it("should use wireframe indices for line-list topology", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "line-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      const resources = cache.getOrCreate(mesh, mockPipeline);

      // Wireframe has different index count than triangles
      // BoxGeometry has 36 triangle indices, wireframe should have more
      expect(resources.topology).toBe("line-list");
      expect(resources.indexCount).toBeGreaterThan(36);
    });
  });

  describe("disposeMesh", () => {
    it("should destroy GPU resources for a specific mesh", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      cache.getOrCreate(mesh, mockPipeline);

      cache.disposeMesh(mesh);

      // Should destroy all 3 buffers
      expect(mockBuffer.destroy).toHaveBeenCalledTimes(3);
    });

    it("should do nothing if mesh has no cached resources", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      // Don't call getOrCreate
      cache.disposeMesh(mesh);

      // Should not throw or destroy anything
      expect(mockBuffer.destroy).not.toHaveBeenCalled();
    });
  });

  describe("disposeAll", () => {
    it("should destroy all tracked resources", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh1 = new Mesh(geometry, mockMaterial);
      const mesh2 = new Mesh(geometry, mockMaterial);

      cache.getOrCreate(mesh1, mockPipeline);
      cache.getOrCreate(mesh2, mockPipeline);

      cache.disposeAll();

      // Should destroy all buffers from both meshes (3 buffers × 2 meshes = 6)
      expect(mockBuffer.destroy).toHaveBeenCalledTimes(6);
    });

    it("should allow creating new resources after disposeAll", () => {
      const cache = new MeshResourceCache({
        device: mockDevice,
        fallback: mockFallback,
      });

      const mockMaterial: Material = {
        type: "test-material",
        bindingRevision: 0,
        getPrimitiveTopology: () => "triangle-list",
        getVertexShader: () => "",
        getFragmentShader: () => "",
        getVertexBufferLayout: () => ({
          arrayStride: 32,
          attributes: [],
        }),
        getUniformBufferSize: () => 64,
        writeUniformData: () => {},
      };

      const geometry = new BoxGeometry(1, 1, 1);
      const mesh = new Mesh(geometry, mockMaterial);

      cache.getOrCreate(mesh, mockPipeline);
      cache.disposeAll();

      // Should be able to create new resources
      const resources = cache.getOrCreate(mesh, mockPipeline);
      expect(resources).toBeDefined();
      // 3 initial + 3 after disposeAll
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(6);
    });
  });
});
