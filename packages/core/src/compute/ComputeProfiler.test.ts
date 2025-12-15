import { describe, it, expect, beforeAll } from "bun:test";
import { ComputeProfiler } from "./ComputeProfiler";
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
  if (typeof GPUMapMode === "undefined") {
    (globalThis as any).GPUMapMode = {
      READ: 0x0001,
      WRITE: 0x0002,
    };
  }
});

// Mock GPUDevice without timestamp-query support
function createMockDeviceWithoutTimestamp(): GPUDevice {
  return {
    features: {
      has: (_feature: string) => false,
    },
    createQuerySet: () => ({}),
    createBuffer: () => ({
      mapAsync: async () => {},
      getMappedRange: () => new ArrayBuffer(16),
      unmap: () => {},
      destroy: () => {},
    }),
  } as unknown as GPUDevice;
}

// Mock GPUDevice with timestamp-query support
function createMockDeviceWithTimestamp(): GPUDevice & {
  _querySet: any;
  _resolveBuffer: any;
  _resultBuffer: any;
} {
  const querySet = {
    type: "timestamp",
    count: 2,
    destroy: () => {},
  };

  const resolveBuffer = {
    destroy: () => {},
  };

  const resultBuffer = {
    mapState: "unmapped",
    mapAsync: async () => {},
    getMappedRange: () => {
      // Return buffer with mock timestamp data (BigInt64Array)
      const buffer = new ArrayBuffer(16);
      const view = new BigInt64Array(buffer);
      view[0] = BigInt(1000000); // Begin timestamp
      view[1] = BigInt(2000000); // End timestamp (1ms later)
      return buffer;
    },
    unmap: () => {},
    destroy: () => {},
  };

  return {
    features: {
      has: (feature: string) => feature === "timestamp-query",
    },
    createQuerySet: () => querySet,
    createBuffer: (descriptor: GPUBufferDescriptor) => {
      if (descriptor.usage & GPUBufferUsage.QUERY_RESOLVE) {
        return resolveBuffer;
      }
      return resultBuffer;
    },
    _querySet: querySet,
    _resolveBuffer: resolveBuffer,
    _resultBuffer: resultBuffer,
  } as unknown as GPUDevice & {
    _querySet: any;
    _resolveBuffer: any;
    _resultBuffer: any;
  };
}

// Mock GPUCommandEncoder
function createMockEncoder(): GPUCommandEncoder & {
  _timestamps: { querySet: any; index: number }[];
  _resolved: boolean;
} {
  const timestamps: { querySet: any; index: number }[] = [];

  return {
    _timestamps: timestamps,
    _resolved: false,
    writeTimestamp: (querySet: GPUQuerySet, index: number) => {
      timestamps.push({ querySet, index });
    },
    resolveQuerySet: () => {
      (mockEncoder as any)._resolved = true;
    },
    copyBufferToBuffer: () => {},
    finish: () => ({}),
    beginComputePass: () => ({}),
    beginRenderPass: () => ({}),
    clearBuffer: () => {},
    copyBufferToTexture: () => {},
    copyTextureToBuffer: () => {},
    copyTextureToTexture: () => {},
    insertDebugMarker: () => {},
    popDebugGroup: () => {},
    pushDebugGroup: () => {},
    label: "",
  } as unknown as GPUCommandEncoder & {
    _timestamps: { querySet: any; index: number }[];
    _resolved: boolean;
  };
}

let mockEncoder: ReturnType<typeof createMockEncoder>;

describe("ComputeProfiler", () => {
  describe("constructor", () => {
    it("should throw if device is not provided", () => {
      expect(() => {
        new ComputeProfiler(null as unknown as GPUDevice);
      }).toThrow(ComputeShaderError);
    });

    it("should create profiler without timestamp support (graceful fallback)", () => {
      const mockDevice = createMockDeviceWithoutTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      expect(profiler.isSupported).toBe(false);
    });

    it("should create profiler with timestamp support", () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      expect(profiler.isSupported).toBe(true);
    });
  });

  describe("isSupported", () => {
    it("should return false when timestamp-query not available", () => {
      const mockDevice = createMockDeviceWithoutTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      expect(profiler.isSupported).toBe(false);
    });

    it("should return true when timestamp-query is available", () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      expect(profiler.isSupported).toBe(true);
    });
  });

  describe("getTimestampWrites", () => {
    it("should return undefined when not supported", () => {
      const mockDevice = createMockDeviceWithoutTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      expect(profiler.getTimestampWrites()).toBeUndefined();
    });

    it("should return timestampWrites descriptor when supported", () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      const timestampWrites = profiler.getTimestampWrites();

      expect(timestampWrites).toBeDefined();
      expect(timestampWrites?.querySet).toBe(profiler.querySet!);
      expect(timestampWrites?.beginningOfPassWriteIndex).toBe(0);
      expect(timestampWrites?.endOfPassWriteIndex).toBe(1);
    });
  });

  describe("resolve", () => {
    it("should do nothing when not supported", () => {
      const mockDevice = createMockDeviceWithoutTimestamp();
      const profiler = new ComputeProfiler(mockDevice);
      mockEncoder = createMockEncoder();

      profiler.resolve(mockEncoder);

      expect(mockEncoder._resolved).toBe(false);
    });

    it("should resolve queries when supported", () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);
      mockEncoder = createMockEncoder();

      profiler.resolve(mockEncoder);

      expect(mockEncoder._resolved).toBe(true);
    });
  });

  describe("resolveAsync", () => {
    it("should return 0 when not supported", async () => {
      const mockDevice = createMockDeviceWithoutTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      const result = await profiler.resolveAsync();

      expect(result).toBe(0);
    });

    it("should throw if getTimestampWrites not called", async () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      await expect(profiler.resolveAsync()).rejects.toThrow(ComputeShaderError);
    });

    it("should return elapsed time in nanoseconds", async () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);
      mockEncoder = createMockEncoder();

      // Simulate getTimestampWrites being called
      profiler.getTimestampWrites();
      profiler.resolve(mockEncoder);

      const result = await profiler.resolveAsync();

      // Mock returns 2000000 - 1000000 = 1000000 ns
      expect(result).toBe(1000000);
    });
  });

  describe("reset", () => {
    it("should reset internal state", async () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);
      mockEncoder = createMockEncoder();

      profiler.getTimestampWrites();
      profiler.resolve(mockEncoder);
      await profiler.resolveAsync();

      // After resolveAsync, state should be reset
      // Calling resolveAsync again should throw
      await expect(profiler.resolveAsync()).rejects.toThrow(ComputeShaderError);
    });

    it("should allow manual reset", () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      profiler.getTimestampWrites();
      profiler.reset();

      // After reset, should throw because getTimestampWrites not called again
      expect(profiler.resolveAsync()).rejects.toThrow(ComputeShaderError);
    });
  });

  describe("destroy", () => {
    it("should destroy resources when supported", () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      // This test verifies destroy() doesn't throw.
      expect(() => profiler.destroy()).not.toThrow();
    });

    it("should not throw when not supported", () => {
      const mockDevice = createMockDeviceWithoutTimestamp();
      const profiler = new ComputeProfiler(mockDevice);

      expect(() => profiler.destroy()).not.toThrow();
    });
  });

  describe("label", () => {
    it("should use label in resource creation", () => {
      const mockDevice = createMockDeviceWithTimestamp();
      const profiler = new ComputeProfiler(mockDevice, {
        label: "MyProfiler",
      });

      expect(profiler.isSupported).toBe(true);
    });
  });
});
