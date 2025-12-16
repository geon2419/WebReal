import { useEffect, useRef, useState } from "react";

import { Link } from "../../routing";
import { PerspectiveCameraController } from "./PerspectiveCameraController";

export default function PerspectiveCameraPage() {
  const observerCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>("Loading...");

  useEffect(() => {
    const canvasObserver = observerCanvasRef.current;
    const canvasMain = mainCanvasRef.current;
    if (!canvasObserver || !canvasMain) {
      return;
    }

    const controller = new PerspectiveCameraController({
      canvasObserver,
      canvasMain,
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
          Perspective Camera
        </div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Left: observer view • Right: main camera (orbit)
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
            width: "min(1200px, calc(100vw - 48px))",
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#888" }}>
              Observer View (Perspective Camera)
            </div>
            <div
              style={{
                width: "100%",
                aspectRatio: "4 / 3",
                border: "2px solid #202020",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <canvas
                ref={observerCanvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#888" }}>
              Main View (Perspective Camera)
            </div>
            <div
              style={{
                width: "100%",
                aspectRatio: "4 / 3",
                border: "2px solid #202020",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <canvas
                ref={mainCanvasRef}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
            </div>
          </div>
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
