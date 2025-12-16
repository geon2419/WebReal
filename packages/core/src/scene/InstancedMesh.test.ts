import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";
import { Matrix4 } from "@web-real/math";
import { InstancedMesh } from "./InstancedMesh";
import type { Geometry } from "../geometry/Geometry";
import type { Material } from "../material/Material";

// Mock WebGPU constants for Node.js test environment
beforeAll(() => {
  (globalThis as any).GPUBufferUsage = {
    MAP_READ: 0x0001,
    MAP_WRITE: 0x0002,
    COPY_SRC: 0x0004,
    COPY_DST: 0x0008,
    INDEX: 0x0010,
    VERTEX: 0x0020,
    UNIFORM: 0x0040,
    STORAGE: 0x0080,
    INDIRECT: 0x0100,
    QUERY_RESOLVE: 0x0200,
  };
});

// Mock geometry
const createMockGeometry = (): Geometry => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
  indices: new Uint16Array([0, 1, 2]),
  vertexCount: 3,
  indexCount: 3,
});

// Mock material
const createMockMaterial = (): Material => ({
  type: "basic",
  getVertexShader: () => "vertex shader",
  getFragmentShader: () => "fragment shader",
  getVertexBufferLayout: () => ({
    arrayStride: 24,
    attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
  }),
  getUniformBufferSize: () => 64,
  getPrimitiveTopology: () => "triangle-list",
});

describe("InstancedMesh", () => {
  let geometry: Geometry;
  let material: Material;

  beforeEach(() => {
    geometry = createMockGeometry();
    material = createMockMaterial();
  });

  describe("constructor", () => {
    it("should create instance with default matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      expect(mesh.instanceCount).toBe(10);
      expect(mesh.mode).toBe("matrix");
      expect(mesh.instanceSize).toBe(1.0);
    });

    it("should create instance with position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 100, {
        mode: "position",
        instanceSize: 0.5,
      });

      expect(mesh.instanceCount).toBe(100);
      expect(mesh.mode).toBe("position");
      expect(mesh.instanceSize).toBe(0.5);
    });

    it("should initialize instance data with identity matrices in matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 2);
      const data = mesh.instanceData;

      // First instance: identity matrix (16 floats) + white color (4 floats) = 20 floats
      // Identity matrix column 0
      expect(data[0]).toBe(1);
      expect(data[1]).toBe(0);
      expect(data[2]).toBe(0);
      expect(data[3]).toBe(0);
      // Column 3 (translation)
      expect(data[12]).toBe(0);
      expect(data[13]).toBe(0);
      expect(data[14]).toBe(0);
      expect(data[15]).toBe(1);
      // White color
      expect(data[16]).toBe(1);
      expect(data[17]).toBe(1);
      expect(data[18]).toBe(1);
      expect(data[19]).toBe(1);
    });

    it("should initialize instance data with zero positions in position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 2, {
        mode: "position",
      });
      const data = mesh.instanceData;

      // First instance: position (3) + padding (1) + color (4) = 8 floats
      expect(data[0]).toBe(0); // x
      expect(data[1]).toBe(0); // y
      expect(data[2]).toBe(0); // z
      expect(data[3]).toBe(0); // padding
      // White color
      expect(data[4]).toBe(1);
      expect(data[5]).toBe(1);
      expect(data[6]).toBe(1);
      expect(data[7]).toBe(1);
    });

    it("should extend Mesh class", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      expect(mesh.geometry).toBe(geometry);
      expect(mesh.material).toBe(material);
    });
  });

  describe("setMatrixAt / getMatrixAt", () => {
    it("should set and get matrix in matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const matrix = new Matrix4().translate({
        x: 5,
        y: 10,
        z: 15,
      } as any);

      mesh.setMatrixAt(0, matrix);
      const result = mesh.getMatrixAt(0);

      // Check translation column
      expect(result.data[12]).toBe(5);
      expect(result.data[13]).toBe(10);
      expect(result.data[14]).toBe(15);
    });

    it("should mark storage update needed after setMatrixAt", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      // Clear the initial flag
      (mesh as any)._needsStorageUpdate = false;

      const matrix = new Matrix4();
      mesh.setMatrixAt(0, matrix);

      expect(mesh.needsStorageUpdate).toBe(true);
    });

    it("should throw error for out of bounds index", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const matrix = new Matrix4();

      expect(() => mesh.setMatrixAt(-1, matrix)).toThrow(
        "Instance index -1 out of bounds"
      );
      expect(() => mesh.setMatrixAt(10, matrix)).toThrow(
        "Instance index 10 out of bounds"
      );
    });

    it("should throw error in position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });
      const matrix = new Matrix4();

      expect(() => mesh.setMatrixAt(0, matrix)).toThrow(
        "setMatrixAt() is only available in matrix mode"
      );
      expect(() => mesh.getMatrixAt(0)).toThrow(
        "getMatrixAt() is only available in matrix mode"
      );
    });
  });

  describe("setPositionAt / getPositionAt", () => {
    it("should set and get position in position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });

      mesh.setPositionAt(0, 1, 2, 3);
      const result = mesh.getPositionAt(0);

      expect(result.x).toBe(1);
      expect(result.y).toBe(2);
      expect(result.z).toBe(3);
    });

    it("should mark storage update needed after setPositionAt", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });
      (mesh as any)._needsStorageUpdate = false;

      mesh.setPositionAt(0, 1, 2, 3);

      expect(mesh.needsStorageUpdate).toBe(true);
    });

    it("should throw error for out of bounds index", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });

      expect(() => mesh.setPositionAt(-1, 0, 0, 0)).toThrow(
        "Instance index -1 out of bounds"
      );
      expect(() => mesh.setPositionAt(10, 0, 0, 0)).toThrow(
        "Instance index 10 out of bounds"
      );
    });

    it("should throw error in matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      expect(() => mesh.setPositionAt(0, 1, 2, 3)).toThrow(
        "setPositionAt() is only available in position mode"
      );
      expect(() => mesh.getPositionAt(0)).toThrow(
        "getPositionAt() is only available in position mode"
      );
    });
  });

  describe("setColorAt / getColorAt", () => {
    it("should set and get color in matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      mesh.setColorAt(0, 1, 0, 0, 0.5);
      const result = mesh.getColorAt(0);

      expect(result.r).toBe(1);
      expect(result.g).toBe(0);
      expect(result.b).toBe(0);
      expect(result.a).toBe(0.5);
    });

    it("should set and get color in position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });

      mesh.setColorAt(0, 0, 1, 0, 1);
      const result = mesh.getColorAt(0);

      expect(result.r).toBe(0);
      expect(result.g).toBe(1);
      expect(result.b).toBe(0);
      expect(result.a).toBe(1);
    });

    it("should default alpha to 1.0", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      mesh.setColorAt(0, 0.5, 0.5, 0.5);
      const result = mesh.getColorAt(0);

      expect(result.a).toBe(1);
    });

    it("should mark storage update needed", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      (mesh as any)._needsStorageUpdate = false;

      mesh.setColorAt(0, 1, 1, 1, 1);

      expect(mesh.needsStorageUpdate).toBe(true);
    });

    it("should throw error for out of bounds index", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      expect(() => mesh.setColorAt(-1, 1, 1, 1, 1)).toThrow(
        "Instance index -1 out of bounds"
      );
      expect(() => mesh.getColorAt(10)).toThrow(
        "Instance index 10 out of bounds"
      );
    });
  });

  describe("storage buffer", () => {
    it("should create storage buffer on first call", () => {
      const mesh = new InstancedMesh(geometry, material, 100);

      const mockBuffer = { label: "test" };
      const mockDevice = {
        createBuffer: vi.fn().mockReturnValue(mockBuffer),
        queue: {
          writeBuffer: vi.fn(),
        },
      } as unknown as GPUDevice;

      const buffer = mesh.getStorageBuffer(mockDevice);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: mesh.instanceData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: "InstancedMesh-StorageBuffer-100",
      });
      expect(buffer).toBe(mockBuffer);
    });

    it("should return cached storage buffer on subsequent calls", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      const mockBuffer = { label: "test" };
      const mockDevice = {
        createBuffer: vi.fn().mockReturnValue(mockBuffer),
        queue: {
          writeBuffer: vi.fn(),
        },
      } as unknown as GPUDevice;

      const buffer1 = mesh.getStorageBuffer(mockDevice);
      const buffer2 = mesh.getStorageBuffer(mockDevice);

      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(1);
      expect(buffer1).toBe(buffer2);
    });

    it("should update storage buffer when needsStorageUpdate is true", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      const mockBuffer = { label: "test" };
      const mockDevice = {
        createBuffer: vi.fn().mockReturnValue(mockBuffer),
        queue: {
          writeBuffer: vi.fn(),
        },
      } as unknown as GPUDevice;

      // Create buffer first
      mesh.getStorageBuffer(mockDevice);

      // Trigger an update
      mesh.setColorAt(0, 1, 0, 0, 1);

      // Update should write to buffer
      mesh.updateStorageBuffer(mockDevice);

      // Initial write + update write = 2 calls
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledTimes(2);
    });

    it("should not update storage buffer when needsStorageUpdate is false", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      const mockBuffer = { label: "test" };
      const mockDevice = {
        createBuffer: vi.fn().mockReturnValue(mockBuffer),
        queue: {
          writeBuffer: vi.fn(),
        },
      } as unknown as GPUDevice;

      // Create buffer first
      mesh.getStorageBuffer(mockDevice);

      // Clear the update flag (simulating previous update)
      (mesh as any)._needsStorageUpdate = false;

      mesh.updateStorageBuffer(mockDevice);

      // Only initial write, no update
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledTimes(1);
    });
  });

  describe("getInstanceByteSize", () => {
    it("should return 80 bytes for matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      expect(mesh.getInstanceByteSize()).toBe(80);
    });

    it("should return 32 bytes for position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });
      expect(mesh.getInstanceByteSize()).toBe(32);
    });
  });

  describe("markStorageNeedsUpdate", () => {
    it("should set needsStorageUpdate to true", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      (mesh as any)._needsStorageUpdate = false;

      mesh.markStorageNeedsUpdate();

      expect(mesh.needsStorageUpdate).toBe(true);
    });
  });

  describe("dispose", () => {
    it("should destroy storage buffer", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      const destroyMock = vi.fn();
      const mockBuffer = { destroy: destroyMock };
      const mockDevice = {
        createBuffer: vi.fn().mockReturnValue(mockBuffer),
        queue: {
          writeBuffer: vi.fn(),
        },
      } as unknown as GPUDevice;

      mesh.getStorageBuffer(mockDevice);
      mesh.dispose();

      expect(destroyMock).toHaveBeenCalled();
    });

    it("should handle dispose without storage buffer created", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      // Should not throw
      expect(() => mesh.dispose()).not.toThrow();
    });
  });

  describe("instanceSize property", () => {
    it("should allow setting instanceSize", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
        instanceSize: 1.0,
      });

      mesh.instanceSize = 2.5;

      expect(mesh.instanceSize).toBe(2.5);
    });
  });
});
