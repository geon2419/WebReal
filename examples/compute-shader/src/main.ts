import { Engine } from "@web-real/core";
import { runAnalysis } from "./analysis";
import { renderError, renderResults, updateLoadingText } from "./ui";

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  try {
    updateLoadingText("Initializing WebGPU...");

    let engine: Engine;
    try {
      engine = await Engine.create({
        canvas,
        requiredFeatures: ["timestamp-query"],
      });
    } catch {
      engine = await Engine.create({ canvas });
    }

    const analysisResult = await runAnalysis(
      engine.device,
      {
        classesUrl: "/assets/elliptic_txs_classes.csv",
        edgesUrl: "/assets/elliptic_txs_edgelist.csv",
        targetNodeCount: 1500,
      },
      updateLoadingText
    );

    renderResults(analysisResult);

    window.addEventListener("beforeunload", () => {
      engine.dispose();
    });
  } catch (error) {
    renderError(
      error instanceof Error ? error.message : "An unknown error occurred."
    );
  }
}

main();
