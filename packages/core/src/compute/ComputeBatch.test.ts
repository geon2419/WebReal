import { describe, it, expect } from "bun:test";
import { ComputeBatch } from "./ComputeBatch";
import { ComputeShader } from "./ComputeShader";
import { ComputeShaderError } from "./ComputeShaderError";
import type { ComputeProfiler } from "./ComputeProfiler";

const SIMPLE_SHADER = `
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;
  
  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3u) {
    data[id.x] *= 2.0;
  }
`;

interface DispatchRecord {
  x: number;
  y: number;
  z: number;
}

interface BindGroupRecord {
  index: number;
  bindGroup: GPUBindGroup;
}

function createMockPassEncoder(): GPUComputePassEncoder & {
  _dispatches: DispatchRecord[];
  _boundGroups: BindGroupRecord[];
  _pipelines: GPUComputePipeline[];
  _descriptor?: GPUComputePassDescriptor;
} {
  const dispatches: DispatchRecord[] = [];
  const boundGroups: BindGroupRecord[] = [];
  const pipelines: GPUComputePipeline[] = [];

  return {
    _dispatches: dispatches,
    _boundGroups: boundGroups,
    _pipelines: pipelines,
    _descriptor: undefined,
    setPipeline: (pipeline: GPUComputePipeline) => {
      pipelines.push(pipeline);
    },
    setBindGroup: (index: number, bindGroup: GPUBindGroup) => {
      boundGroups.push({ index, bindGroup });
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
    _boundGroups: BindGroupRecord[];
    _pipelines: GPUComputePipeline[];
    _descriptor?: GPUComputePassDescriptor;
  };
}

function createMockDevice(): GPUDevice & {
  _passEncoders: ReturnType<typeof createMockPassEncoder>[];
} {
  const passEncoders: ReturnType<typeof createMockPassEncoder>[] = [];

  return {
    _passEncoders: passEncoders,
    createShaderModule: () => ({
      getCompilationInfo: async () => ({ messages: [] }),
    }),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createComputePipeline: () => ({
      getBindGroupLayout: () => ({}),
    }),
    createBindGroup: (descriptor: GPUBindGroupDescriptor) =>
      ({ ...descriptor }) as unknown as GPUBindGroup,
    createCommandEncoder: () => ({
      beginComputePass: (descriptor?: GPUComputePassDescriptor) => {
        const passEncoder = createMockPassEncoder();
        passEncoder._descriptor = descriptor;
        passEncoders.push(passEncoder);
        return passEncoder;
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
    _passEncoders: ReturnType<typeof createMockPassEncoder>[];
  };
}

function createMockShader(device: GPUDevice): ComputeShader {
  return new ComputeShader(device, { code: SIMPLE_SHADER });
}

type MockProfiler = {
  getTimestampWrites: () => GPUComputePassTimestampWrites;
  resolve: (encoder: GPUCommandEncoder) => void;
  _getTimestampWritesCalls: number;
  _resolveCalls: number;
  _lastEncoder?: GPUCommandEncoder;
  _timestampWrites: GPUComputePassTimestampWrites;
};

function createMockProfiler(): MockProfiler {
  const timestampWrites: GPUComputePassTimestampWrites = {
    querySet: {} as GPUQuerySet,
    beginningOfPassWriteIndex: 0,
    endOfPassWriteIndex: 1,
  };

  const profiler: MockProfiler = {
    getTimestampWrites: function () {
      profiler._getTimestampWritesCalls += 1;
      return profiler._timestampWrites;
    },
    resolve: function (encoder: GPUCommandEncoder) {
      profiler._resolveCalls += 1;
      profiler._lastEncoder = encoder;
    },
    _getTimestampWritesCalls: 0,
    _resolveCalls: 0,
    _lastEncoder: undefined,
    _timestampWrites: timestampWrites,
  };

  return profiler;
}

describe("ComputeBatch", () => {
  it("should throw if device is not provided", () => {
    expect(() => {
      new ComputeBatch(null as unknown as GPUDevice);
    }).toThrow(ComputeShaderError);
  });

  it("should throw if entry is invalid", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const batch = new ComputeBatch(device);

    expect(() => {
      batch.add(null as unknown as any);
    }).toThrow(ComputeShaderError);

    expect(() => {
      batch.add({ shader: null as unknown as ComputeShader, workgroups: [1] });
    }).toThrow(ComputeShaderError);

    expect(() => {
      batch.add({ shader, workgroups: null as unknown as any });
    }).toThrow(ComputeShaderError);

    expect(() => {
      batch.add({ shader, workgroups: [] as unknown as any });
    }).toThrow(ComputeShaderError);

    expect(() => {
      batch.add({ shader, workgroups: [undefined] as unknown as any });
    }).toThrow(ComputeShaderError);

    expect(() => {
      batch.add({ shader, workgroups: {} as unknown as any });
    }).toThrow(ComputeShaderError);

    expect(() => {
      batch.add({ shader, workgroups: { y: 1 } as unknown as any });
    }).toThrow(ComputeShaderError);

    expect(() => {
      batch.add({ shader, workgroups: { x: NaN } as unknown as any });
    }).toThrow(ComputeShaderError);
  });

  it("should throw if submit is called with no entries", () => {
    const device = createMockDevice();
    const batch = new ComputeBatch(device);

    expect(() => {
      batch.submit();
    }).toThrow(ComputeShaderError);
  });

  it("should batch multiple dispatches into a single pass", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const batch = new ComputeBatch(device, { passMode: "single" });

    const entries = [{ binding: 0, resource: { buffer: {} as GPUBuffer } }];

    batch
      .add({
        shader,
        workgroups: [64],
        bindings: { 0: entries },
      })
      .add({
        shader,
        workgroups: { x: 2, y: 3 },
        bindings: { 0: entries },
      });

    batch.submit();

    const passEncoders = (device as any)._passEncoders;
    expect(passEncoders.length).toBe(1);
    expect(passEncoders[0]._dispatches).toEqual([
      { x: 64, y: 1, z: 1 },
      { x: 2, y: 3, z: 1 },
    ]);
    expect(passEncoders[0]._pipelines.length).toBe(2);
    expect(passEncoders[0]._boundGroups.length).toBe(2);
  });

  it("should create a pass per dispatch when passMode is perDispatch", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const batch = new ComputeBatch(device, { passMode: "perDispatch" });

    const entries = [{ binding: 0, resource: { buffer: {} as GPUBuffer } }];

    batch
      .add({
        shader,
        workgroups: [1],
        bindings: { 0: entries },
      })
      .add({
        shader,
        workgroups: [2, 3, 4],
        bindings: { 0: entries },
      });

    batch.submit();

    const passEncoders = (device as any)._passEncoders;
    expect(passEncoders.length).toBe(2);
    expect(passEncoders[0]._dispatches[0]).toEqual({ x: 1, y: 1, z: 1 });
    expect(passEncoders[1]._dispatches[0]).toEqual({ x: 2, y: 3, z: 4 });
  });

  it("should throw if both bindings and bindGroups use the same index", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const batch = new ComputeBatch(device);

    batch.add({
      shader,
      workgroups: [1],
      bindings: { 0: [{ binding: 0, resource: { buffer: {} as GPUBuffer } }] },
      bindGroups: { 0: {} as GPUBindGroup },
    });

    expect(() => {
      batch.submit();
    }).toThrow(ComputeShaderError);
  });

  it("should support submitAsync", async () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const batch = new ComputeBatch(device);

    batch.add({
      shader,
      workgroups: [1],
      bindings: { 0: [{ binding: 0, resource: { buffer: {} as GPUBuffer } }] },
    });

    const result = batch.submitAsync();
    expect(result).toBeInstanceOf(Promise);
    await result;
  });

  it("should use profiler with passMode single", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const profiler = createMockProfiler();
    const batch = new ComputeBatch(device, {
      passMode: "single",
      profiler: profiler as unknown as ComputeProfiler,
    });

    const entries = [{ binding: 0, resource: { buffer: {} as GPUBuffer } }];

    batch
      .add({
        shader,
        workgroups: [1],
        bindings: { 0: entries },
      })
      .add({
        shader,
        workgroups: [2],
        bindings: { 0: entries },
      });

    batch.submit();

    const passEncoders = (device as any)._passEncoders;
    expect(passEncoders.length).toBe(1);
    expect(passEncoders[0]._descriptor?.timestampWrites).toBe(
      profiler._timestampWrites,
    );
    expect(profiler._getTimestampWritesCalls).toBe(1);
    expect(profiler._resolveCalls).toBe(1);
  });

  it("should allow profiler with perDispatch when only one entry", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const profiler = createMockProfiler();
    const batch = new ComputeBatch(device, {
      passMode: "perDispatch",
      profiler: profiler as unknown as ComputeProfiler,
    });

    batch.add({
      shader,
      workgroups: [1],
      bindings: { 0: [{ binding: 0, resource: { buffer: {} as GPUBuffer } }] },
    });

    batch.submit();

    const passEncoders = (device as any)._passEncoders;
    expect(passEncoders.length).toBe(1);
    expect(passEncoders[0]._descriptor?.timestampWrites).toBe(
      profiler._timestampWrites,
    );
    expect(profiler._getTimestampWritesCalls).toBe(1);
    expect(profiler._resolveCalls).toBe(1);
  });

  it("should throw when profiler uses perDispatch with multiple entries", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const profiler = createMockProfiler();
    const batch = new ComputeBatch(device, {
      passMode: "perDispatch",
      profiler: profiler as unknown as ComputeProfiler,
    });

    const entries = [{ binding: 0, resource: { buffer: {} as GPUBuffer } }];

    batch
      .add({
        shader,
        workgroups: [1],
        bindings: { 0: entries },
      })
      .add({
        shader,
        workgroups: [2],
        bindings: { 0: entries },
      });

    expect(() => {
      batch.submit();
    }).toThrow("Profiler requires passMode 'single' or a single dispatch");
  });

  it("should clear entries and allow reuse", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const batch = new ComputeBatch(device);

    batch.add({
      shader,
      workgroups: [1],
      bindings: { 0: [{ binding: 0, resource: { buffer: {} as GPUBuffer } }] },
    });

    batch.clear();

    expect(() => {
      batch.submit();
    }).toThrow("No dispatch entries to submit");

    batch.add({
      shader,
      workgroups: [2],
      bindings: { 0: [{ binding: 0, resource: { buffer: {} as GPUBuffer } }] },
    });

    expect(() => {
      batch.submit();
    }).not.toThrow();
  });

  it("should throw for invalid bind group indices", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);

    const entries = [{ binding: 0, resource: { buffer: {} as GPUBuffer } }];

    const batchNonNumeric = new ComputeBatch(device);
    batchNonNumeric.add({
      shader,
      workgroups: [1],
      bindings: { abc: entries } as unknown as Record<
        number,
        GPUBindGroupEntry[]
      >,
    });

    expect(() => {
      batchNonNumeric.submit();
    }).toThrow('Invalid bind group index "abc" in bindings');

    const batchNegative = new ComputeBatch(device);
    batchNegative.add({
      shader,
      workgroups: [1],
      bindings: { "-1": entries } as unknown as Record<
        number,
        GPUBindGroupEntry[]
      >,
    });

    expect(() => {
      batchNegative.submit();
    }).toThrow('Invalid bind group index "-1" in bindings');

    const batchFloat = new ComputeBatch(device);
    batchFloat.add({
      shader,
      workgroups: [1],
      bindings: { "1.5": entries } as unknown as Record<
        number,
        GPUBindGroupEntry[]
      >,
    });

    expect(() => {
      batchFloat.submit();
    }).toThrow('Invalid bind group index "1.5" in bindings');
  });

  it("should require at least one bind group", () => {
    const device = createMockDevice();
    const shader = createMockShader(device);
    const batch = new ComputeBatch(device);

    batch.add({
      shader,
      workgroups: [1],
    });

    expect(() => {
      batch.submit();
    }).toThrow("At least one bind group must be set for dispatch");
  });
});
