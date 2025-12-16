import { useEffect, useRef } from "react";

import { GraphController } from "./GraphController";
import { Link } from "../../routing";

export default function VisualComputeShaderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = new GraphController({
      canvas,
      statsElement: statsRef.current,
    });

    void controller.init();

    return () => {
      controller.dispose();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <div
        ref={statsRef}
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          color: "white",
          fontFamily: "monospace",
          fontSize: 14,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          padding: "8px 12px",
          borderRadius: 4,
        }}
      >
        Loading...
      </div>
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          color: "white",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          padding: "6px 10px",
          borderRadius: 6,
          userSelect: "none",
        }}
      >
        <Link to="/" style={{ color: "inherit" }} title="Go to examples">
          Examples
        </Link>
      </div>
    </div>
  );
}
