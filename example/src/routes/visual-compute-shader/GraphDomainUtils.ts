export type NodeClassCode = 0 | 1 | 2; // 0=unknown, 1=illicit, 2=licit

export interface NodeIndexTables {
  txIdToIndex: Map<number, number>;
  indexToTxId: Uint32Array;
  indexToClass: Uint8Array;
}

export class GraphDomainUtils {
  static getSimulationBounds(spaceScale: number): [number, number, number] {
    const s = Math.max(0.1, spaceScale);
    // Keep previous shape ratio (Z a bit deeper than XY)
    return [0.95 * s, 0.95 * s, 1.5 * s];
  }
}
