import Papa from "papaparse";

export interface NodeData {
  id: number;
  class: 1 | 2 | "unknown";
  x: number;
  y: number;
  z: number;
}

interface ClassRow {
  txId: string;
  class: string;
}

export class NodeDataLoader {
  private static _resolveClassesCsvUrl(): URL {
    // `src/assets/*` is not served at `/assets/*` in Vite dev.
    // Resolve via ESM URL so dev/prod both load the real CSV.
    return new URL("./assets/elliptic_txs_classes.csv", import.meta.url);
  }

  private static async _fetchText(
    url: URL,
    options?: { signal?: AbortSignal }
  ): Promise<string> {
    const response = await fetch(url, { signal: options?.signal });
    return await response.text();
  }

  private static _parseClassRows(csvText: string): Promise<ClassRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<ClassRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data.filter(
            (row): row is ClassRow =>
              typeof row?.txId === "string" && typeof row?.class === "string"
          );

          // If we accidentally fetched HTML (e.g., index.html), fail loudly.
          if (rows.length === 0) {
            reject(new Error("Failed to parse CSV data: Invalid format"));
            return;
          }

          resolve(rows);
        },
        error: (error: Error) => reject(error),
      });
    });
  }

  private static _parseClassValue(classValue: string): 1 | 2 | "unknown" {
    if (classValue === "1") {
      return 1; // illicit
    }
    if (classValue === "2") {
      return 2; // licit
    }
    return "unknown";
  }

  private static _randomInitialPosition(
    spaceScale: number
  ): Pick<NodeData, "x" | "y" | "z"> {
    // Initial random position in circle (radius 0.8 * s)
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 0.8 * spaceScale;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    // Depth spread (scaled) so perspective view has depth.
    const z = (Math.random() * 2 - 1) * 1.2 * spaceScale;

    return { x, y, z };
  }

  private static _mapRowsToNodes(
    rows: ClassRow[],
    maxNodes: number,
    spaceScale: number
  ): NodeData[] {
    const dataRows = rows.slice(0, maxNodes);
    const s = Math.max(0.01, spaceScale);

    const nodes: NodeData[] = [];
    for (const row of dataRows) {
      const id = parseInt(row.txId);
      const classValue = NodeDataLoader._parseClassValue(row.class);
      const { x, y, z } = NodeDataLoader._randomInitialPosition(s);
      nodes.push({ id, class: classValue, x, y, z });
    }

    return nodes;
  }

  /**
   * Load and parse node data from CSV file with sampling support
   * @param maxNodes Maximum number of nodes to load (for progressive scaling)
   * @returns Array of node data with initial random positions
   */
  static async loadNodeData(
    maxNodes: number = 10000,
    spaceScale: number = 1,
    options?: { signal?: AbortSignal }
  ): Promise<NodeData[]> {
    const url = NodeDataLoader._resolveClassesCsvUrl();
    const csvText = await NodeDataLoader._fetchText(url, options);
    const rows = await NodeDataLoader._parseClassRows(csvText);
    const nodes = NodeDataLoader._mapRowsToNodes(rows, maxNodes, spaceScale);
    return nodes;
  }

  /**
   * Get color based on node class
   * @param nodeClass Node classification
   * @returns RGB color tuple
   */
  static getNodeColor(nodeClass: 1 | 2 | "unknown"): [number, number, number] {
    switch (nodeClass) {
      case 1:
        return [1, 0, 0]; // illicit - red
      case 2:
        return [0, 1, 0]; // licit - green
      case "unknown":
        return [0.5, 0.5, 0.5]; // unknown - gray
    }
  }
}
