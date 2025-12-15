import {
  ComputeBuffer,
  ComputePass,
  ComputeProfiler,
  ComputeShader,
} from "@web-real/core";
import type { Edge, RiskNode, TransactionClass } from "./analysis";

const NEIGHBOR_ANALYSIS_SHADER = /* wgsl */ `
  @group(0) @binding(0) var<storage, read> nodeClasses: array<u32>;
  @group(0) @binding(1) var<storage, read> edges: array<u32>;
  @group(0) @binding(2) var<storage, read_write> results: array<u32>;
  @group(0) @binding(3) var<uniform> params: vec2<u32>;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let nodeIdx = globalId.x;
    let nodeCount = params.x;
    let edgeCount = params.y;
    
    if (nodeIdx >= nodeCount) {
      return;
    }
    
    var totalNeighbors: u32 = 0;
    var illicitNeighbors: u32 = 0;
    var licitNeighbors: u32 = 0;
    var unknownNeighbors: u32 = 0;
    
    for (var i: u32 = 0; i < edgeCount; i++) {
      let src = edges[i * 2];
      let dst = edges[i * 2 + 1];
      
      var neighborIdx: u32 = 0xFFFFFFFF;
      
      if (src == nodeIdx) {
        neighborIdx = dst;
      } else if (dst == nodeIdx) {
        neighborIdx = src;
      }
      
      if (neighborIdx != 0xFFFFFFFF && neighborIdx < nodeCount) {
        totalNeighbors++;
        let neighborClass = nodeClasses[neighborIdx];
        
        if (neighborClass == 2) {
          illicitNeighbors++;
        } else if (neighborClass == 1) {
          licitNeighbors++;
        } else {
          unknownNeighbors++;
        }
      }
    }
    
    let resultIdx = nodeIdx * 4;
    results[resultIdx] = totalNeighbors;
    results[resultIdx + 1] = illicitNeighbors;
    results[resultIdx + 2] = licitNeighbors;
    results[resultIdx + 3] = unknownNeighbors;
  }
`;

export interface GpuNeighborAnalysisResult {
  results: Uint32Array;
  gpuTimeMs: number;
  gpuWallTimeMs: number;
  nodeIdMapping: Map<number, number>;
}

export async function runNeighborAnalysisGpu(
  device: GPUDevice,
  classes: TransactionClass[],
  edges: Edge[]
): Promise<GpuNeighborAnalysisResult> {
  const gpuStartTime = performance.now();

  const nodeIdMapping = new Map<number, number>();
  classes.forEach((c, idx) => {
    nodeIdMapping.set(c.txId, idx);
  });

  const nodeCount = classes.length;
  const edgeCount = edges.length;

  const nodeClassData = new Uint32Array(nodeCount);
  classes.forEach((c, idx) => {
    if (c.class === "1") nodeClassData[idx] = 1;
    else if (c.class === "2") nodeClassData[idx] = 2;
    else nodeClassData[idx] = 0;
  });

  const edgeData = new Uint32Array(edgeCount * 2);
  edges.forEach((e, idx) => {
    const srcIdx = nodeIdMapping.get(e.txId1);
    const dstIdx = nodeIdMapping.get(e.txId2);
    if (srcIdx !== undefined && dstIdx !== undefined) {
      edgeData[idx * 2] = srcIdx;
      edgeData[idx * 2 + 1] = dstIdx;
    }
  });

  const paramsData = new Uint32Array([nodeCount, edgeCount]);
  const resultSize = nodeCount * 4 * 4;

  const nodeClassBuffer = new ComputeBuffer(device, {
    size: nodeClassData.byteLength,
    label: "Node Classes",
  });
  const edgeBuffer = new ComputeBuffer(device, {
    size: edgeData.byteLength,
    label: "Edges",
  });
  const resultBuffer = new ComputeBuffer(device, {
    size: resultSize,
    label: "Results",
  });
  const paramsBuffer = new ComputeBuffer(device, {
    size: paramsData.byteLength,
    label: "Params",
    additionalUsage: GPUBufferUsage.UNIFORM,
  });

  let profiler: ComputeProfiler | undefined;

  try {
    nodeClassBuffer.write(nodeClassData);
    edgeBuffer.write(edgeData);
    paramsBuffer.write(paramsData);

    const shader = new ComputeShader(device, {
      code: NEIGHBOR_ANALYSIS_SHADER,
      entryPoint: "main",
      label: "Neighbor Analysis Shader",
    });

    const bindGroup = shader.createBindGroup(0, [
      { binding: 0, resource: { buffer: nodeClassBuffer.gpuBuffer } },
      { binding: 1, resource: { buffer: edgeBuffer.gpuBuffer } },
      { binding: 2, resource: { buffer: resultBuffer.gpuBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer.gpuBuffer } },
    ]);

    try {
      profiler = new ComputeProfiler(device);
    } catch {
      console.warn("timestamp-query not supported, skipping GPU profiling");
    }

    const pass = new ComputePass(device, {
      shader,
      label: "Neighbor Analysis Pass",
      profiler,
    });

    pass.setBindGroup(0, bindGroup);

    const workgroupCount = Math.ceil(nodeCount / 64);
    await pass.dispatchAsync(workgroupCount);

    let gpuTimeMs = 0;
    if (profiler?.isSupported) {
      const gpuTimeNs = await profiler.resolveAsync();
      gpuTimeMs = gpuTimeNs > 0 ? gpuTimeNs / 1_000_000 : 0;
    }

    const results = new Uint32Array(await resultBuffer.readAsync());
    const gpuWallTimeMs = performance.now() - gpuStartTime;

    return { results, gpuTimeMs, gpuWallTimeMs, nodeIdMapping };
  } finally {
    nodeClassBuffer.destroy();
    edgeBuffer.destroy();
    resultBuffer.destroy();
    paramsBuffer.destroy();
    profiler?.destroy();
  }
}

export function runNeighborAnalysisCpu(
  classes: TransactionClass[],
  edges: Edge[]
): number {
  const cpuStartTime = performance.now();

  const nodeIdMapping = new Map<number, number>();
  classes.forEach((c, idx) => nodeIdMapping.set(c.txId, idx));

  const nodeCount = classes.length;
  const results = new Uint32Array(nodeCount * 4);

  const adjacency = new Map<number, number[]>();
  for (const edge of edges) {
    const srcIdx = nodeIdMapping.get(edge.txId1);
    const dstIdx = nodeIdMapping.get(edge.txId2);

    if (srcIdx !== undefined && dstIdx !== undefined) {
      if (!adjacency.has(srcIdx)) adjacency.set(srcIdx, []);
      if (!adjacency.has(dstIdx)) adjacency.set(dstIdx, []);
      adjacency.get(srcIdx)!.push(dstIdx);
      adjacency.get(dstIdx)!.push(srcIdx);
    }
  }

  for (let i = 0; i < nodeCount; i++) {
    const neighbors = adjacency.get(i) || [];
    let illicit = 0,
      licit = 0,
      unknown = 0;

    for (const neighborIdx of neighbors) {
      const neighborClass = classes[neighborIdx].class;
      if (neighborClass === "2") illicit++;
      else if (neighborClass === "1") licit++;
      else unknown++;
    }

    results[i * 4] = neighbors.length;
    results[i * 4 + 1] = illicit;
    results[i * 4 + 2] = licit;
    results[i * 4 + 3] = unknown;
  }

  return performance.now() - cpuStartTime;
}

export function computeRiskNodes(
  results: Uint32Array,
  classes: TransactionClass[],
  nodeIdMapping: Map<number, number>
): RiskNode[] {
  const reverseMapping = new Map<number, number>();
  nodeIdMapping.forEach((idx, txId) => reverseMapping.set(idx, txId));

  const riskNodes: RiskNode[] = [];

  for (let i = 0; i < classes.length; i++) {
    const totalNeighbors = results[i * 4];
    const illicitNeighbors = results[i * 4 + 1];

    if (totalNeighbors > 0) {
      const riskScore = illicitNeighbors / totalNeighbors;
      const txId = reverseMapping.get(i)!;

      riskNodes.push({
        txId,
        neighborCount: totalNeighbors,
        illicitNeighbors,
        riskScore,
      });
    }
  }

  riskNodes.sort((a, b) => b.riskScore - a.riskScore);
  return riskNodes;
}
