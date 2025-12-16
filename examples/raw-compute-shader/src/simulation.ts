import { ComputeShader } from "@web-real/core";

export interface SimulationParams {
  repulsionStrength: number;
  centerGravity: number;
  damping: number;
  deltaTime: number;
  bounds: [number, number, number];
}

const COMPUTE_SHADER_CODE = `
struct Node {
  position: vec3<f32>,
  padding: f32,
  color: vec4<f32>,
};

struct Params {
  repulsionStrength: f32,
  centerGravity: f32,
  damping: f32,
  deltaTime: f32,
  nodeCount: u32,
  bounds: vec3<f32>,
};

@group(0) @binding(0) var<storage, read_write> nodes: array<Node>;
@group(0) @binding(1) var<uniform> params: Params;

// Simple force-directed layout
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.nodeCount) { return; }

  var force = vec3<f32>(0.0, 0.0, 0.0);
  let pos_i = nodes[i].position;

  // Repulsion (sampled) - avoids O(N^2)
  let samples = min(128u, max(params.nodeCount, 1u));
  var seed = i * 1664525u + 1013904223u;
  for (var k = 0u; k < samples; k++) {
    seed = seed * 1664525u + 1013904223u;
    let j = seed % params.nodeCount;
    if (i == j) { continue; }

    let pos_j = nodes[j].position;
    let delta = pos_i - pos_j;
    let dist_sq = max(dot(delta, delta), 0.01);
    let dist = sqrt(dist_sq);

    force += (delta / dist) * (params.repulsionStrength / dist_sq);
  }

  // Center gravity (pull towards origin)
  force -= pos_i * params.centerGravity;

  // Update position with damping
  var new_pos = pos_i + force * params.deltaTime;
  new_pos *= params.damping;

  // Clamp to user-controlled bounds
  let b = params.bounds;
  new_pos = clamp(new_pos, -b, b);

  nodes[i].position = new_pos;
}
`;

/**
 * GPU-based force-directed layout simulation
 */
export class NodeSimulation {
  private device: GPUDevice;
  private computeShader: ComputeShader;
  private paramsBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup | null = null;
  private nodeCount: number;

  constructor(device: GPUDevice, nodeCount: number) {
    this.device = device;
    this.nodeCount = nodeCount;

    // Create compute shader
    this.computeShader = new ComputeShader(device, {
      code: COMPUTE_SHADER_CODE,
      label: "NodeSimulation",
    });

    // Create params uniform buffer
    // WGSL struct alignment: 4 f32 (16) + u32 (4) + padding (12) + vec3 padding = 48 bytes
    this.paramsBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: "SimulationParams",
    });
  }

  /**
   * Create bind group linking storage buffer and params
   */
  createBindGroup(storageBuffer: GPUBuffer): void {
    this.bindGroup = this.computeShader.createBindGroup(0, [
      { binding: 0, resource: { buffer: storageBuffer } },
      { binding: 1, resource: { buffer: this.paramsBuffer } },
    ]);
  }

  /**
   * Update simulation parameters
   */
  updateParams(params: SimulationParams): void {
    const data = new ArrayBuffer(48);
    const floatView = new Float32Array(data);
    const uintView = new Uint32Array(data);

    floatView[0] = params.repulsionStrength;
    floatView[1] = params.centerGravity;
    floatView[2] = params.damping;
    floatView[3] = params.deltaTime;
    uintView[4] = this.nodeCount; // offset 16 bytes

    // vec3<f32> is 16-byte aligned; it starts at offset 32 bytes.
    floatView[8] = params.bounds[0];
    floatView[9] = params.bounds[1];
    floatView[10] = params.bounds[2];

    this.device.queue.writeBuffer(this.paramsBuffer, 0, data);
  }

  /**
   * Execute one simulation step
   */
  compute(commandEncoder: GPUCommandEncoder): void {
    if (!this.bindGroup) {
      throw new Error("Bind group not created. Call createBindGroup first.");
    }

    const passEncoder = commandEncoder.beginComputePass({
      label: "NodeSimulation",
    });

    const pipeline = this.computeShader.getPipeline();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);

    const workgroupCount = Math.ceil(this.nodeCount / 64);
    passEncoder.dispatchWorkgroups(workgroupCount);

    passEncoder.end();
  }

  /**
   * Dispose GPU resources
   */
  dispose(): void {
    this.paramsBuffer.destroy();
  }
}
