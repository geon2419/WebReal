import { describe, it, expect, beforeEach, vi, beforeAll } from "bun:test";
import { Matrix4, Vector3 } from "@web-real/math";
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

const createMockGeometry = (): Geometry => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
  indices: new Uint16Array([0, 1, 2]),
  vertexCount: 3,
  indexCount: 3,
});

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

const createMockDevice = (buffer?: Partial<GPUBuffer>) => {
  const mockBuffer = (buffer ?? { destroy: vi.fn() }) as unknown as GPUBuffer;
  const mockDevice = {
    createBuffer: vi.fn().mockReturnValue(mockBuffer),
    queue: {
      writeBuffer: vi.fn(),
    },
  } as unknown as GPUDevice;

  return { mockDevice, mockBuffer };
};

describe("InstancedMesh", () => {
  let geometry: Geometry;
  let material: Material;

  beforeEach(() => {
    geometry = createMockGeometry();
    material = createMockMaterial();
  });

  describe("constructor", () => {
    it("initializes matrix mode instance layout and defaults", () => {
      const mesh = new InstancedMesh(geometry, material, 2);
      const data = mesh.instanceData;

      expect(mesh.instanceCount).toBe(2);
      expect(mesh.mode).toBe("matrix");
      expect(mesh.instanceSize).toBe(1.0);
      expect(data).toHaveLength(2 * 20); // 20 floats per instance

      // First instance: identity diagonal + white color
      expect(data[0]).toBe(1);
      expect(data[5]).toBe(1);
      expect(data[10]).toBe(1);
      expect(data[15]).toBe(1);
      expect(data.slice(16, 20)).toEqual(new Float32Array([1, 1, 1, 1]));
    });

    it("initializes position mode instance layout, defaults, and instanceSize", () => {
      const mesh = new InstancedMesh(geometry, material, 2, {
        mode: "position",
        instanceSize: 0.5,
      });
      const data = mesh.instanceData;

      expect(mesh.instanceCount).toBe(2);
      expect(mesh.mode).toBe("position");
      expect(mesh.instanceSize).toBe(0.5);
      expect(data).toHaveLength(2 * 8); // 8 floats per instance

      // First instance: position (0,0,0) + padding + white color
      expect(data.slice(0, 4)).toEqual(new Float32Array([0, 0, 0, 0]));
      expect(data.slice(4, 8)).toEqual(new Float32Array([1, 1, 1, 1]));

      mesh.instanceSize = 2.5;
      expect(mesh.instanceSize).toBe(2.5);
    });
  });

  describe("setMatrixAt / getMatrixAt", () => {
    it("sets and gets matrix in matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const matrix = new Matrix4().translate(new Vector3(5, 10, 15));

      mesh.setMatrixAt(0, matrix);
      const result = mesh.getMatrixAt(0);

      expect(result.data[12]).toBe(5);
      expect(result.data[13]).toBe(10);
      expect(result.data[14]).toBe(15);
    });

    it.each([
      [
        "setMatrixAt",
        (mesh: InstancedMesh, index: number) =>
          mesh.setMatrixAt(index, new Matrix4()),
      ],
      [
        "getMatrixAt",
        (mesh: InstancedMesh, index: number) => mesh.getMatrixAt(index),
      ],
    ])("validates instance index bounds for %s", (_name, call) => {
      const mesh = new InstancedMesh(geometry, material, 10);
      expect(() => call(mesh, -1)).toThrow(/Instance index -1 out of bounds/);
      expect(() => call(mesh, 10)).toThrow(/Instance index 10 out of bounds/);
    });

    it("throws in position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });

      expect(() => mesh.setMatrixAt(0, new Matrix4())).toThrow(
        /setMatrixAt\(\) is only available in matrix mode/,
      );
      expect(() => mesh.getMatrixAt(0)).toThrow(
        /getMatrixAt\(\) is only available in matrix mode/,
      );
    });
  });

  describe("setPositionAt / getPositionAt", () => {
    it("sets and gets position in position mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });

      mesh.setPositionAt(0, 1, 2, 3);
      expect(mesh.getPositionAt(0)).toEqual({ x: 1, y: 2, z: 3 });
    });

    it.each([
      [
        "setPositionAt",
        (mesh: InstancedMesh, index: number) =>
          mesh.setPositionAt(index, 0, 0, 0),
      ],
      [
        "getPositionAt",
        (mesh: InstancedMesh, index: number) => mesh.getPositionAt(index),
      ],
    ])("validates instance index bounds for %s", (_name, call) => {
      const mesh = new InstancedMesh(geometry, material, 10, {
        mode: "position",
      });
      expect(() => call(mesh, -1)).toThrow(/Instance index -1 out of bounds/);
      expect(() => call(mesh, 10)).toThrow(/Instance index 10 out of bounds/);
    });

    it("throws in matrix mode", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      expect(() => mesh.setPositionAt(0, 1, 2, 3)).toThrow(
        /setPositionAt\(\) is only available in position mode/,
      );
      expect(() => mesh.getPositionAt(0)).toThrow(
        /getPositionAt\(\) is only available in position mode/,
      );
    });
  });

  describe("setColorAt / getColorAt", () => {
    it.each([
      ["matrix", {}],
      ["position", { mode: "position" as const }],
    ])("sets and gets colors in %s mode", (_name, options) => {
      const mesh = new InstancedMesh(geometry, material, 10, options as any);

      mesh.setColorAt(0, 1, 0.25, 0.5, 0.75);
      expect(mesh.getColorAt(0)).toEqual({ r: 1, g: 0.25, b: 0.5, a: 0.75 });
    });

    it("defaults alpha to 1.0", () => {
      const mesh = new InstancedMesh(geometry, material, 10);

      mesh.setColorAt(0, 0.5, 0.5, 0.5);
      expect(mesh.getColorAt(0).a).toBe(1);
    });

    it.each([
      [
        "setColorAt",
        (mesh: InstancedMesh, index: number) =>
          mesh.setColorAt(index, 1, 1, 1, 1),
      ],
      [
        "getColorAt",
        (mesh: InstancedMesh, index: number) => mesh.getColorAt(index),
      ],
    ])("validates instance index bounds for %s", (_name, call) => {
      const mesh = new InstancedMesh(geometry, material, 10);
      expect(() => call(mesh, -1)).toThrow(/Instance index -1 out of bounds/);
      expect(() => call(mesh, 10)).toThrow(/Instance index 10 out of bounds/);
    });
  });

  describe("storage buffer", () => {
    it("creates buffer once, uploads initial data, and clears dirty flag", () => {
      const mesh = new InstancedMesh(geometry, material, 100);
      const { mockDevice, mockBuffer } = createMockDevice();

      const buffer = mesh.getStorageBuffer(mockDevice);

      expect(mockDevice.createBuffer).toHaveBeenCalledWith({
        size: mesh.instanceData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        label: "InstancedMesh-StorageBuffer-100",
      });
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledTimes(1);
      expect(mesh.needsStorageUpdate).toBe(false);
      expect(buffer).toBe(mockBuffer);
    });

    it("returns cached storage buffer on subsequent calls", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const { mockDevice } = createMockDevice();

      const buffer1 = mesh.getStorageBuffer(mockDevice);
      const buffer2 = mesh.getStorageBuffer(mockDevice);

      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(1);
      expect(buffer1).toBe(buffer2);
    });

    it("updates storage buffer only when instance data changes", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const { mockDevice } = createMockDevice();

      mesh.getStorageBuffer(mockDevice);
      expect(mesh.needsStorageUpdate).toBe(false);

      mesh.setColorAt(0, 1, 0, 0, 1);
      expect(mesh.needsStorageUpdate).toBe(true);

      mesh.updateStorageBuffer(mockDevice);
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledTimes(2); // initial + update
      expect(mesh.needsStorageUpdate).toBe(false);

      mesh.updateStorageBuffer(mockDevice);
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledTimes(2); // no extra writes
    });

    it("supports manual edits via instanceData + markStorageNeedsUpdate", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const { mockDevice } = createMockDevice();

      mesh.getStorageBuffer(mockDevice);
      expect(mesh.needsStorageUpdate).toBe(false);

      mesh.instanceData[0] = 42;
      mesh.markStorageNeedsUpdate();
      expect(mesh.needsStorageUpdate).toBe(true);

      mesh.updateStorageBuffer(mockDevice);
      expect(mockDevice.queue.writeBuffer).toHaveBeenCalledTimes(2);
      expect(mesh.needsStorageUpdate).toBe(false);
    });

    it("does nothing if updateStorageBuffer is called before getStorageBuffer", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const { mockDevice } = createMockDevice();

      mesh.updateStorageBuffer(mockDevice);
      expect(mockDevice.queue.writeBuffer).not.toHaveBeenCalled();
    });
  });

  describe("getInstanceByteSize", () => {
    it.each([
      ["matrix", {}, 80],
      ["position", { mode: "position" as const }, 32],
    ])("returns correct byte size for %s mode", (_name, options, expected) => {
      const mesh = new InstancedMesh(geometry, material, 10, options as any);
      expect(mesh.getInstanceByteSize()).toBe(expected);
    });
  });

  describe("dispose", () => {
    it("destroys storage buffer and releases reference", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      const destroyMock = vi.fn();
      const { mockDevice } = createMockDevice({ destroy: destroyMock });

      mesh.getStorageBuffer(mockDevice);
      mesh.dispose();

      expect(destroyMock).toHaveBeenCalled();
    });

    it("is safe to call without a storage buffer", () => {
      const mesh = new InstancedMesh(geometry, material, 10);
      expect(() => mesh.dispose()).not.toThrow();
    });
  });
});
