import { ComputeShader } from "@web-real/core";
import nodeSimulationComputeShader from "./shaders/nodeSimulationCompute.wgsl?raw";

export interface SimulationParams {
  repulsionStrength: number;
  centerGravity: number;
  damping: number;
  deltaTime: number;
  bounds: [number, number, number];
}

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
      code: nodeSimulationComputeShader,
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
