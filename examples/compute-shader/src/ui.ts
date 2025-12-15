import type { AnalysisResult } from "./analysis";

/**
 * Renders the analysis results into the UI.
 * @param result - AnalysisResult object containing stats and risk nodes
 */
export function renderResults(result: AnalysisResult): void {
  const app = document.getElementById("app")!;

  const { stats, riskNodes, gpuTimeMs, cpuTimeMs, throughput } = result;

  const licitPct = ((stats.licitCount / stats.totalNodes) * 100).toFixed(1);
  const illicitPct = ((stats.illicitCount / stats.totalNodes) * 100).toFixed(1);
  const unknownPct = ((stats.unknownCount / stats.totalNodes) * 100).toFixed(1);

  const topRiskNodes = riskNodes.filter((n) => n.riskScore > 0).slice(0, 10);

  app.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="card-header">
          <div class="card-icon blue">📊</div>
          <div class="card-title">Dataset Summary</div>
        </div>
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-label">Total Nodes</div>
            <div class="stat-value blue">${stats.totalNodes.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Total Edges</div>
            <div class="stat-value purple">${stats.totalEdges.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Licit</div>
            <div class="stat-value green">${stats.licitCount.toLocaleString()}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Illicit</div>
            <div class="stat-value red">${stats.illicitCount.toLocaleString()}</div>
          </div>
        </div>
        
        <div class="distribution-bar">
          <div class="segment licit" style="width: ${licitPct}%">${licitPct}%</div>
          <div class="segment illicit" style="width: ${illicitPct}%">${illicitPct}%</div>
          <div class="segment unknown" style="width: ${unknownPct}%">${unknownPct}%</div>
        </div>
        
        <div class="distribution-legend">
          <div class="legend-item">
            <div class="legend-dot licit"></div>
            <span>Licit (${stats.licitCount})</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot illicit"></div>
            <span>Illicit (${stats.illicitCount})</span>
          </div>
          <div class="legend-item">
            <div class="legend-dot unknown"></div>
            <span>Unknown (${stats.unknownCount})</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-icon green">⚡</div>
          <div class="card-title">GPU Performance</div>
        </div>
        
        <div class="performance-item">
          <span class="performance-label">GPU Time</span>
          <span class="performance-value" style="color: #3fb950;">
            ${
              gpuTimeMs > 0
                ? gpuTimeMs.toFixed(3) + " ms"
                : "N/A (timestamp-query not supported)"
            }
          </span>
        </div>
        <div class="performance-item">
          <span class="performance-label">CPU Time</span>
          <span class="performance-value" style="color: #d29922;">${cpuTimeMs.toFixed(
            3
          )} ms</span>
        </div>
        <div class="performance-item">
          <span class="performance-label">Speedup</span>
          <span class="performance-value" style="color: #58a6ff;">
            ${gpuTimeMs > 0 ? (cpuTimeMs / gpuTimeMs).toFixed(1) + "x" : "N/A"}
          </span>
        </div>
        <div class="performance-item">
          <span class="performance-label">Throughput</span>
          <span class="performance-value" style="color: #a371f7;">
            ${(throughput / 1000).toFixed(1)}K nodes/ms
          </span>
        </div>
      </div>

      <div class="card full-width">
        <div class="card-header">
          <div class="card-icon orange">🔍</div>
          <div class="card-title">High-Risk Nodes Top 10</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Tx ID</th>
              <th>Neighbors</th>
              <th>Illicit Neighbors</th>
              <th>Risk</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            ${topRiskNodes
              .map(
                (node, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td style="font-family: monospace; color: #58a6ff;">${
                  node.txId
                }</td>
                <td>${node.neighborCount}</td>
                <td style="color: #f85149;">${node.illicitNeighbors}</td>
                <td>${(node.riskScore * 100).toFixed(1)}%</td>
                <td>
                  <span class="risk-badge ${
                    node.riskScore >= 0.7
                      ? "high"
                      : node.riskScore >= 0.4
                      ? "medium"
                      : "low"
                  }">
                    ${
                      node.riskScore >= 0.7
                        ? "HIGH"
                        : node.riskScore >= 0.4
                        ? "MEDIUM"
                        : "LOW"
                    }
                  </span>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        ${
          topRiskNodes.length === 0
            ? '<div style="text-align: center; padding: 20px; color: #8b949e;">No nodes with illicit neighbors found.</div>'
            : ""
        }
      </div>
    </div>
  `;
}

/**
 * Renders an error message into the UI.
 * @param message - Error message string
 */
export function renderError(message: string): void {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div class="card full-width">
      <div class="error">
        <strong>Error</strong><br>
        ${message}
      </div>
    </div>
  `;
}

/**
 * Updates the loading text in the UI.
 * @param text - Loading text string
 */
export function updateLoadingText(text: string): void {
  const loadingText = document.querySelector(".loading-text");
  if (loadingText) {
    loadingText.textContent = text;
  }
}
