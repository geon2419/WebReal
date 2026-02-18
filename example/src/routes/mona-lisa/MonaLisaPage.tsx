import { useEffect, useRef, useState } from "react";

import { Link } from "../../routing";
import { MonaLisaController } from "./MonaLisaController";

export default function MonaLisaPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>("Loading...");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const controller = new MonaLisaController({
      canvas,
      onStatusChange: setStatus,
    });

    void controller.init().catch((error: unknown) => {
      console.error(error);
      setStatus(error instanceof Error ? error.message : String(error));
    });

    return () => {
      controller.dispose();
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#101010",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          background: "rgba(0, 0, 0, 0.7)",
          padding: "10px 14px",
          borderRadius: 10,
          fontFamily: "system-ui, sans-serif",
          color: "white",
          maxWidth: 360,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 4 }}>
          2.5D Parallax Mona Lisa
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Move mouse to control light • Use GUI to adjust parameters
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          {status}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "min(500px, calc(100vw - 48px), calc(100vh - 48px))",
            height: "min(500px, calc(100vw - 48px), calc(100vh - 48px))",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          color: "white",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          padding: "6px 10px",
          borderRadius: 8,
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
