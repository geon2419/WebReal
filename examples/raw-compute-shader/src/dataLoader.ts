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

/**
 * Load and parse node data from CSV file with sampling support
 * @param maxNodes Maximum number of nodes to load (for progressive scaling)
 * @returns Array of node data with initial random positions
 */
export async function loadNodeData(
  maxNodes: number = 10000,
  spaceScale: number = 1
): Promise<NodeData[]> {
  // `src/assets/*` is not served at `/assets/*` in Vite dev.
  // Resolve via ESM URL so dev/prod both load the real CSV.
  const url = new URL("./assets/elliptic_txs_classes.csv", import.meta.url);
  const response = await fetch(url);
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse<ClassRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // If we accidentally fetched HTML (e.g., index.html), fail loudly.
        const first = results.data[0] as unknown as
          | Partial<ClassRow>
          | undefined;
        if (
          !first ||
          typeof first.txId !== "string" ||
          typeof first.class !== "string"
        ) {
          reject(
            new Error(
              "CSV 파싱 실패: txId/class 컬럼을 찾지 못했습니다. 파일 경로를 확인하세요."
            )
          );
          return;
        }

        const nodes: NodeData[] = [];
        const dataRows = results.data.slice(0, maxNodes);

        for (const row of dataRows) {
          const id = parseInt(row.txId);
          let classValue: 1 | 2 | "unknown";

          if (row.class === "1") {
            classValue = 1; // illicit
          } else if (row.class === "2") {
            classValue = 2; // licit
          } else {
            classValue = "unknown";
          }

          const s = Math.max(0.01, spaceScale);

          // Initial random position in circle (radius 0.8 * s)
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.sqrt(Math.random()) * 0.8 * s;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          // Depth spread (scaled) so perspective view has depth.
          const z = (Math.random() * 2 - 1) * 1.2 * s;

          nodes.push({ id, class: classValue, x, y, z });
        }

        console.log(`Loaded ${nodes.length} nodes`);
        resolve(nodes);
      },
      error: (error: Error) => reject(error),
    });
  });
}

/**
 * Get color based on node class
 * @param nodeClass Node classification
 * @returns RGB color tuple
 */
export function getNodeColor(
  nodeClass: 1 | 2 | "unknown"
): [number, number, number] {
  switch (nodeClass) {
    case 1:
      return [1, 0, 0]; // illicit - red
    case 2:
      return [0, 1, 0]; // licit - green
    case "unknown":
      return [0.5, 0.5, 0.5]; // unknown - gray
  }
}
