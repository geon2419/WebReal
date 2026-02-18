import { describe, it, expect, beforeAll } from "bun:test";
import { ComputeBuffer } from "./ComputeBuffer";
import { ComputeShaderError } from "./ComputeShaderError";

// Define WebGPU constants for test environment (not available in Bun/Node.js)
beforeAll(() => {
  if (typeof GPUBufferUsage === "undefined") {
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
  }
});

// Mock GPUBuffer
function createMockGPUBuffer(): GPUBuffer {
  return {
    label: "",
    size: 0,
    usage: 0,
    mapState: "unmapped",
    destroy: () => {},
    getMappedRange: () => new ArrayBuffer(0),
    mapAsync: async () => {},
    unmap: () => {},
  } as unknown as GPUBuffer;
}

// Mock GPUDevice with createBuffer
function createMockDevice(
  options?: Partial<{
    createBuffer: (descriptor: GPUBufferDescriptor) => GPUBuffer;
  }>,
): GPUDevice {
  const createdBuffers: GPUBufferDescriptor[] = [];

  return {
    createBuffer: (descriptor: GPUBufferDescriptor) => {
      createdBuffers.push(descriptor);
      const buffer = createMockGPUBuffer();
      (buffer as any).size = descriptor.size;
      (buffer as any).usage = descriptor.usage;
      (buffer as any).label = descriptor.label;
      return options?.createBuffer?.(descriptor) ?? buffer;
    },
    queue: {
      writeBuffer: () => {},
      submit: () => {},
    },
    createCommandEncoder: () => ({
      copyBufferToBuffer: () => {},
      finish: () => ({}),
    }),
    // Expose for testing
    _createdBuffers: createdBuffers,
  } as unknown as GPUDevice & { _createdBuffers: GPUBufferDescriptor[] };
}

describe("ComputeBuffer", () => {
  describe("constructor", () => {
    it("should throw if device is not provided", () => {
      expect(() => {
        new ComputeBuffer(null as unknown as GPUDevice, { size: 1024 });
      }).toThrow(ComputeShaderError);
    });

    it("should throw if size is 0", () => {
      const mockDevice = createMockDevice();
      expect(() => {
        new ComputeBuffer(mockDevice, { size: 0 });
      }).toThrow(ComputeShaderError);
    });

    it("should throw if size is negative", () => {
      const mockDevice = createMockDevice();
      expect(() => {
        new ComputeBuffer(mockDevice, { size: -100 });
      }).toThrow(ComputeShaderError);
    });

    it("should create buffer with correct size", () => {
      const mockDevice = createMockDevice();
      const buffer = new ComputeBuffer(mockDevice, { size: 1024 });

      expect(buffer.size).toBe(1024);
    });

    it("should create buffer with STORAGE | COPY_SRC | COPY_DST usage", () => {
      const mockDevice = createMockDevice();
      new ComputeBuffer(mockDevice, { size: 1024 });

      const createdBuffer = (mockDevice as any)._createdBuffers[0];
      const expectedUsage =
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST;

      expect(createdBuffer.usage).toBe(expectedUsage);
    });

    it("should add additional usage flags when specified", () => {
      const mockDevice = createMockDevice();
      new ComputeBuffer(mockDevice, {
        size: 1024,
        additionalUsage: GPUBufferUsage.VERTEX,
      });

      const createdBuffer = (mockDevice as any)._createdBuffers[0];
      const expectedUsage =
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.VERTEX;

      expect(createdBuffer.usage).toBe(expectedUsage);
    });

    it("should use default label when not specified", () => {
      const mockDevice = createMockDevice();
      new ComputeBuffer(mockDevice, { size: 1024 });

      const createdBuffer = (mockDevice as any)._createdBuffers[0];
      expect(createdBuffer.label).toBe("ComputeBuffer");
    });

    it("should use custom label when specified", () => {
      const mockDevice = createMockDevice();
      new ComputeBuffer(mockDevice, { size: 1024, label: "MyBuffer" });

      const createdBuffer = (mockDevice as any)._createdBuffers[0];
      expect(createdBuffer.label).toBe("MyBuffer");
    });
  });

  describe("gpuBuffer", () => {
    it("should return the underlying GPU buffer", () => {
      const mockDevice = createMockDevice();
      const computeBuffer = new ComputeBuffer(mockDevice, { size: 1024 });

      expect(computeBuffer.gpuBuffer).toBeDefined();
      expect(computeBuffer.gpuBuffer.size).toBe(1024);
    });
  });

  describe("write", () => {
    it("should not throw when writing valid data", () => {
      const mockDevice = createMockDevice();
      const buffer = new ComputeBuffer(mockDevice, { size: 1024 });

      expect(() => {
        buffer.write(new Float32Array([1, 2, 3, 4]));
      }).not.toThrow();
    });

    it("should throw when data exceeds buffer size", () => {
      const mockDevice = createMockDevice();
      const buffer = new ComputeBuffer(mockDevice, { size: 16 });

      expect(() => {
        // 100 floats * 4 bytes = 400 bytes > 16 bytes
        buffer.write(new Float32Array(100));
      }).toThrow(ComputeShaderError);
    });

    it("should throw when data with offset exceeds buffer size", () => {
      const mockDevice = createMockDevice();
      const buffer = new ComputeBuffer(mockDevice, { size: 32 });

      expect(() => {
        // Writing 16 bytes at offset 20 = 36 bytes needed > 32 bytes
        buffer.write(new Float32Array(4), 20);
      }).toThrow(ComputeShaderError);
    });

    it("should accept ArrayBuffer", () => {
      const mockDevice = createMockDevice();
      const buffer = new ComputeBuffer(mockDevice, { size: 1024 });

      expect(() => {
        buffer.write(new ArrayBuffer(64));
      }).not.toThrow();
    });

    it("should accept typed arrays", () => {
      const mockDevice = createMockDevice();
      const buffer = new ComputeBuffer(mockDevice, { size: 1024 });

      expect(() => {
        buffer.write(new Uint8Array(64));
        buffer.write(new Int32Array(16));
        buffer.write(new Float64Array(8));
      }).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("should call destroy on the underlying buffer", () => {
      let destroyCalled = false;
      const mockDevice = createMockDevice({
        createBuffer: () => {
          const buffer = createMockGPUBuffer();
          buffer.destroy = () => {
            destroyCalled = true;
          };
          return buffer;
        },
      });

      const buffer = new ComputeBuffer(mockDevice, { size: 1024 });
      buffer.destroy();

      expect(destroyCalled).toBe(true);
    });
  });

  // Note: readAsync tests require actual GPU buffer mapping
  // and would be integration tests
});
