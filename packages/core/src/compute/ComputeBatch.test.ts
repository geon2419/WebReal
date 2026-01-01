import { describe, it, expect } from "bun:test";
import { ComputeBatch } from "./ComputeBatch";
import { ComputeShader } from "./ComputeShader";
import { ComputeShaderError } from "./ComputeShaderError";

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
} {
  const dispatches: DispatchRecord[] = [];
  const boundGroups: BindGroupRecord[] = [];
  const pipelines: GPUComputePipeline[] = [];

  return {
    _dispatches: dispatches,
    _boundGroups: boundGroups,
    _pipelines: pipelines,
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
      beginComputePass: () => {
        const passEncoder = createMockPassEncoder();
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
});
