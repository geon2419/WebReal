import { describe, it, expect } from "bun:test";
import { ComputePass } from "./ComputePass";
import { ComputeShader } from "./ComputeShader";
import { ComputeShaderError } from "./ComputeShaderError";

const SIMPLE_SHADER = `
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;
  
  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3u) {
    data[id.x] *= 2.0;
  }
`;

// Track dispatch calls for verification
interface DispatchRecord {
  x: number;
  y: number;
  z: number;
}

// Mock GPUComputePassEncoder
function createMockPassEncoder(): GPUComputePassEncoder & {
  _dispatches: DispatchRecord[];
  _boundGroups: Map<number, GPUBindGroup>;
} {
  const dispatches: DispatchRecord[] = [];
  const boundGroups = new Map<number, GPUBindGroup>();

  return {
    _dispatches: dispatches,
    _boundGroups: boundGroups,
    setPipeline: () => {},
    setBindGroup: (index: number, bindGroup: GPUBindGroup) => {
      boundGroups.set(index, bindGroup);
    },
    dispatchWorkgroups: (x: number, y = 1, z = 1) => {
      dispatches.push({ x, y, z });
    },
    dispatchWorkgroupsIndirect: () => {},
    end: () => {},
    label: "",
    pushDebugGroup: () => {},
    popDebugGroup: () => {},
    insertDebugMarker: () => {},
  } as unknown as GPUComputePassEncoder & {
    _dispatches: DispatchRecord[];
    _boundGroups: Map<number, GPUBindGroup>;
  };
}

// Mock GPUDevice
function createMockDevice(): GPUDevice & {
  _lastPassEncoder: ReturnType<typeof createMockPassEncoder> | null;
} {
  let lastPassEncoder: ReturnType<typeof createMockPassEncoder> | null = null;

  return {
    _lastPassEncoder: null,
    get lastPassEncoder() {
      return lastPassEncoder;
    },
    createShaderModule: () => ({
      getCompilationInfo: async () => ({ messages: [] }),
    }),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createComputePipeline: () => ({
      getBindGroupLayout: () => ({}),
    }),
    createCommandEncoder: () => ({
      beginComputePass: () => {
        lastPassEncoder = createMockPassEncoder();
        return lastPassEncoder;
      },
      finish: () => ({}),
      copyBufferToBuffer: () => {},
      writeTimestamp: () => {},
      resolveQuerySet: () => {},
    }),
    queue: {
      submit: () => {},
      onSubmittedWorkDone: async () => {},
    },
  } as unknown as GPUDevice & {
    _lastPassEncoder: ReturnType<typeof createMockPassEncoder> | null;
  };
}

// Create mock shader
function createMockShader(device: GPUDevice): ComputeShader {
  return new ComputeShader(device, { code: SIMPLE_SHADER });
}

describe("ComputePass", () => {
  describe("constructor", () => {
    it("should throw if device is not provided", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);

      expect(() => {
        new ComputePass(null as unknown as GPUDevice, { shader });
      }).toThrow(ComputeShaderError);
    });

    it("should throw if shader is not provided", () => {
      const mockDevice = createMockDevice();

      expect(() => {
        new ComputePass(mockDevice, {
          shader: null as unknown as ComputeShader,
        });
      }).toThrow(ComputeShaderError);
    });

    it("should create pass with valid parameters", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);

      const pass = new ComputePass(mockDevice, { shader });
      expect(pass.shader).toBe(shader);
    });
  });

  describe("setBindGroup", () => {
    it("should set bind group at specified index", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      const mockBindGroup = {} as GPUBindGroup;
      pass.setBindGroup(0, mockBindGroup);

      expect(pass.getBindGroup(0)).toBe(mockBindGroup);
    });

    it("should support multiple bind groups", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      const bindGroup0 = { id: 0 } as unknown as GPUBindGroup;
      const bindGroup1 = { id: 1 } as unknown as GPUBindGroup;
      const bindGroup2 = { id: 2 } as unknown as GPUBindGroup;

      pass.setBindGroup(0, bindGroup0);
      pass.setBindGroup(1, bindGroup1);
      pass.setBindGroup(2, bindGroup2);

      expect(pass.getBindGroup(0)).toBe(bindGroup0);
      expect(pass.getBindGroup(1)).toBe(bindGroup1);
      expect(pass.getBindGroup(2)).toBe(bindGroup2);
    });

    it("should overwrite existing bind group at same index", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      const firstBindGroup = { first: true } as unknown as GPUBindGroup;
      const secondBindGroup = { second: true } as unknown as GPUBindGroup;

      pass.setBindGroup(0, firstBindGroup);
      pass.setBindGroup(0, secondBindGroup);

      expect(pass.getBindGroup(0)).toBe(secondBindGroup);
    });

    it("should throw for negative index", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      expect(() => {
        pass.setBindGroup(-1, {} as GPUBindGroup);
      }).toThrow(ComputeShaderError);
    });

    it("should return this for chaining", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      const result = pass.setBindGroup(0, {} as GPUBindGroup);
      expect(result).toBe(pass);
    });
  });

  describe("getBindGroup", () => {
    it("should return undefined for unset index", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      expect(pass.getBindGroup(0)).toBeUndefined();
      expect(pass.getBindGroup(5)).toBeUndefined();
    });
  });

  describe("clearBindGroups", () => {
    it("should clear all bind groups", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      pass.setBindGroup(0, {} as GPUBindGroup);
      pass.setBindGroup(1, {} as GPUBindGroup);
      pass.clearBindGroups();

      expect(pass.getBindGroup(0)).toBeUndefined();
      expect(pass.getBindGroup(1)).toBeUndefined();
    });

    it("should return this for chaining", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      const result = pass.clearBindGroups();
      expect(result).toBe(pass);
    });
  });

  describe("dispatch", () => {
    it("should throw if no bind groups are set", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      expect(() => {
        pass.dispatch(64);
      }).toThrow(ComputeShaderError);
    });

    it("should dispatch with only X dimension", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      pass.setBindGroup(0, {} as GPUBindGroup);
      pass.dispatch(64);

      const lastEncoder = (mockDevice as any).lastPassEncoder;
      expect(lastEncoder._dispatches[0]).toEqual({ x: 64, y: 1, z: 1 });
    });

    it("should dispatch with X and Y dimensions", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      pass.setBindGroup(0, {} as GPUBindGroup);
      pass.dispatch(64, 32);

      const lastEncoder = (mockDevice as any).lastPassEncoder;
      expect(lastEncoder._dispatches[0]).toEqual({ x: 64, y: 32, z: 1 });
    });

    it("should dispatch with all three dimensions", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      pass.setBindGroup(0, {} as GPUBindGroup);
      pass.dispatch(64, 32, 16);

      const lastEncoder = (mockDevice as any).lastPassEncoder;
      expect(lastEncoder._dispatches[0]).toEqual({ x: 64, y: 32, z: 16 });
    });

    it("should set all bind groups during dispatch", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      const bindGroup0 = { id: 0 } as unknown as GPUBindGroup;
      const bindGroup2 = { id: 2 } as unknown as GPUBindGroup;

      pass.setBindGroup(0, bindGroup0);
      pass.setBindGroup(2, bindGroup2);
      pass.dispatch(64);

      const lastEncoder = (mockDevice as any).lastPassEncoder;
      expect(lastEncoder._boundGroups.get(0)).toBe(bindGroup0);
      expect(lastEncoder._boundGroups.get(2)).toBe(bindGroup2);
    });
  });

  describe("dispatchAsync", () => {
    it("should return a promise", async () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      pass.setBindGroup(0, {} as GPUBindGroup);
      const result = pass.dispatchAsync(64);

      expect(result).toBeInstanceOf(Promise);
      await result; // Should resolve without error
    });
  });

  describe("chaining", () => {
    it("should support method chaining", () => {
      const mockDevice = createMockDevice();
      const shader = createMockShader(mockDevice);
      const pass = new ComputePass(mockDevice, { shader });

      // Should be able to chain setBindGroup calls
      pass
        .setBindGroup(0, {} as GPUBindGroup)
        .setBindGroup(1, {} as GPUBindGroup)
        .clearBindGroups()
        .setBindGroup(0, {} as GPUBindGroup);

      expect(pass.getBindGroup(0)).toBeDefined();
      expect(pass.getBindGroup(1)).toBeUndefined();
    });
  });
});
