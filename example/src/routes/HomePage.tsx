import { Link } from "../routing";

export default function HomePage() {
  return (
    <div style={{ width: "100vw", minHeight: "100vh", padding: 24, boxSizing: "border-box" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 12px" }}>WebReal Examples</h1>
        <p style={{ margin: "0 0 24px", opacity: 0.8 }}>
          Select an example. Routes are client-side (History API).
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 16,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
              /visual-compute-shader
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
              Visual Compute Shader
            </div>
            <Link to="/visual-compute-shader">Open</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

