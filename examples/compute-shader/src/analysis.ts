import {
  computeRiskNodes,
  runNeighborAnalysisCpu,
  runNeighborAnalysisGpu,
} from "./analysisRunner";

export interface TransactionClass {
  txId: number;
  class: "1" | "2" | "unknown";
}

export interface Edge {
  txId1: number;
  txId2: number;
}

export interface DatasetStats {
  totalNodes: number;
  totalEdges: number;
  licitCount: number;
  illicitCount: number;
  unknownCount: number;
}

export interface RiskNode {
  txId: number;
  neighborCount: number;
  illicitNeighbors: number;
  riskScore: number;
}

export interface AnalysisResult {
  stats: DatasetStats;
  riskNodes: RiskNode[];
  gpuTimeMs: number;
  cpuTimeMs: number;
  throughput: number;
}

export interface AnalysisOptions {
  classesUrl: string;
  edgesUrl: string;
  targetNodeCount: number;
}

export type StatusCallback = (text: string) => void;

/**
 * Parses CSV data for transaction classes.
 * @param csv - CSV string
 * @returns Array of TransactionClass objects
 */
function parseClassesCSV(csv: string): TransactionClass[] {
  const lines = csv.trim().split("\n");
  const results: TransactionClass[] = [];

  for (let i = 1; i < lines.length; i++) {
    const [txIdStr, classStr] = lines[i].split(",");
    const txId = parseInt(txIdStr, 10);
    const txClass = classStr.trim() as "1" | "2" | "unknown";

    if (!isNaN(txId)) {
      results.push({ txId, class: txClass });
    }
  }

  return results;
}

/**
 * Parses CSV data for edges.
 * @param csv - CSV string
 * @returns Array of Edge objects
 */
function parseEdgelistCSV(csv: string): Edge[] {
  const lines = csv.trim().split("\n");
  const results: Edge[] = [];

  for (let i = 1; i < lines.length; i++) {
    const [txId1Str, txId2Str] = lines[i].split(",");
    const txId1 = parseInt(txId1Str, 10);
    const txId2 = parseInt(txId2Str, 10);

    if (!isNaN(txId1) && !isNaN(txId2)) {
      results.push({ txId1, txId2 });
    }
  }

  return results;
}

/**
 * Samples a connected subgraph from the full dataset.
 * @param classes - Array of TransactionClass objects
 * @param edges - Array of Edge objects
 * @param targetNodeCount - Desired number of nodes in the sampled subgraph
 * @returns Object containing sampled classes and edges
 */
function sampleConnectedSubgraph(
  classes: TransactionClass[],
  edges: Edge[],
  targetNodeCount: number
): { sampledClasses: TransactionClass[]; sampledEdges: Edge[] } {
  const txIdSet = new Set(classes.map((c) => c.txId));
  const txIdToClass = new Map(classes.map((c) => [c.txId, c]));

  const validEdges = edges.filter(
    (e) => txIdSet.has(e.txId1) && txIdSet.has(e.txId2)
  );

  const adjacency = new Map<number, Set<number>>();
  for (const edge of validEdges) {
    if (!adjacency.has(edge.txId1)) adjacency.set(edge.txId1, new Set());
    if (!adjacency.has(edge.txId2)) adjacency.set(edge.txId2, new Set());
    adjacency.get(edge.txId1)!.add(edge.txId2);
    adjacency.get(edge.txId2)!.add(edge.txId1);
  }

  const illicitNodes = classes
    .filter((c) => c.class === "2")
    .map((c) => c.txId)
    .filter((id) => adjacency.has(id));

  if (illicitNodes.length === 0) {
    const startNode = Array.from(adjacency.keys())[0];
    illicitNodes.push(startNode);
  }

  const visited = new Set<number>();
  const queue: number[] = [...illicitNodes.slice(0, 10)];
  let queueHead = 0;
  const allNodes = Array.from(adjacency.keys());
  let seedIndex = 0;

  /**
   * Enqueues the next seed node that hasn't been visited yet.
   * @returns boolean indicating if a new seed was enqueued
   */
  const enqueueNextSeed = (): boolean => {
    while (seedIndex < allNodes.length && visited.has(allNodes[seedIndex])) {
      seedIndex++;
    }
    if (seedIndex >= allNodes.length) return false;
    queue.push(allNodes[seedIndex]);
    seedIndex++;
    return true;
  };

  while (visited.size < targetNodeCount) {
    // If the queue is empty, enqueue the next seed node
    if (queueHead >= queue.length) {
      if (!enqueueNextSeed()) {
        break;
      }
      continue;
    }

    const current = queue[queueHead++];
    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && visited.size < targetNodeCount) {
          queue.push(neighbor);
        }
      }
    }
  }

  const sampledClasses = Array.from(visited)
    .map((id) => txIdToClass.get(id)!)
    .filter(Boolean);

  const sampledEdges = validEdges.filter(
    (e) => visited.has(e.txId1) && visited.has(e.txId2)
  );

  return { sampledClasses, sampledEdges };
}

/**
 * Runs the full analysis pipeline using GPU and CPU computations.
 * @param device - GPUDevice to use for GPU computations
 * @param options - AnalysisOptions containing data URLs and target node count
 * @param onStatus - Optional callback for status updates
 * @returns Promise resolving to AnalysisResult
 */
export async function runAnalysis(
  device: GPUDevice,
  options: AnalysisOptions,
  onStatus?: StatusCallback
): Promise<AnalysisResult> {
  onStatus?.("Loading CSV data...");

  const [classesResponse, edgesResponse] = await Promise.all([
    fetch(options.classesUrl),
    fetch(options.edgesUrl),
  ]);

  if (!classesResponse.ok) {
    throw new Error(`Failed to fetch classes CSV: ${classesResponse.status} ${classesResponse.statusText}`);
  }
  if (!edgesResponse.ok) {
    throw new Error(`Failed to fetch edges CSV: ${edgesResponse.status} ${edgesResponse.statusText}`);
  }
  const classesCSV = await classesResponse.text();
  const edgesCSV = await edgesResponse.text();

  onStatus?.("Parsing data...");

  const allClasses = parseClassesCSV(classesCSV);
  const allEdges = parseEdgelistCSV(edgesCSV);

  onStatus?.("Sampling subgraph...");
  const { sampledClasses, sampledEdges } = sampleConnectedSubgraph(
    allClasses,
    allEdges,
    options.targetNodeCount
  );

  const stats: DatasetStats = {
    totalNodes: sampledClasses.length,
    totalEdges: sampledEdges.length,
    licitCount: sampledClasses.filter((c) => c.class === "1").length,
    illicitCount: sampledClasses.filter((c) => c.class === "2").length,
    unknownCount: sampledClasses.filter((c) => c.class === "unknown").length,
  };

  onStatus?.("Running GPU compute shader...");
  const { results, gpuTimeMs, gpuWallTimeMs, nodeIdMapping } =
    await runNeighborAnalysisGpu(device, sampledClasses, sampledEdges);

  onStatus?.("Running CPU analysis...");
  const cpuTimeMs = runNeighborAnalysisCpu(sampledClasses, sampledEdges);
  const riskNodes = computeRiskNodes(results, sampledClasses, nodeIdMapping);

  const throughputDenominatorMs = gpuTimeMs > 0 ? gpuTimeMs : gpuWallTimeMs;
  const throughput = stats.totalNodes / throughputDenominatorMs;

  return {
    stats,
    riskNodes,
    gpuTimeMs,
    cpuTimeMs,
    throughput,
  };
}
