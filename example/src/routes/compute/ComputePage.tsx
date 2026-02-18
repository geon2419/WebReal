import { useEffect, useState } from "react";

import { ComputeBatch, ComputeBuffer, ComputeShader } from "@web-real/core";
import { Link } from "../../routing";

const MULTIPLY_SHADER = `
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3u) {
    if (id.x < arrayLength(&data)) {
      data[id.x] = data[id.x] * 2.0;
    }
  }
`;

const ADD_SHADER = `
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3u) {
    if (id.x < arrayLength(&data)) {
      data[id.x] = data[id.x] + 1.0;
    }
  }
`;

const INPUT_VALUES = [1, 2, 3, 4, 5, 6, 7, 8];

export default function ComputePage() {
  const [status, setStatus] = useState<string>("Idle");
  const [input, setInput] = useState<number[]>(INPUT_VALUES);
  const [output, setOutput] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let buffer: ComputeBuffer | null = null;

    const run = async () => {
      try {
        setStatus("Running");
        setError(null);
        setOutput(null);

        if (!navigator.gpu) {
          throw new Error("WebGPU is not supported in this browser");
        }

        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: "high-performance",
        });
        if (!adapter) {
          throw new Error("Failed to get GPU adapter");
        }

        const device = await adapter.requestDevice();

        const inputData = new Float32Array(INPUT_VALUES);
        buffer = new ComputeBuffer(device, { size: inputData.byteLength });
        buffer.write(inputData);

        const multiplyShader = new ComputeShader(device, {
          code: MULTIPLY_SHADER,
        });
        const addShader = new ComputeShader(device, { code: ADD_SHADER });

        const batch = new ComputeBatch(device, { passMode: "perDispatch" });
        const entries = [
          { binding: 0, resource: { buffer: buffer.gpuBuffer } },
        ];
        const workgroups = Math.ceil(inputData.length / 64);

        batch.add({
          shader: multiplyShader,
          workgroups: [workgroups],
          bindings: { 0: entries },
          label: "Multiply",
        });

        batch.add({
          shader: addShader,
          workgroups: [workgroups],
          bindings: { 0: entries },
          label: "Add",
        });

        await batch.submitAsync();

        const result = new Float32Array(await buffer.readAsync());

        if (cancelled) return;

        setInput(Array.from(inputData));
        setOutput(Array.from(result));
        setStatus("Complete");
      } catch (runError) {
        if (cancelled) return;
        const message =
          runError instanceof Error ? runError.message : String(runError);
        setStatus("Error");
        setError(message);
      } finally {
        if (buffer) {
          buffer.destroy();
          buffer = null;
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 12px" }}>Compute (perDispatch)</h1>
            <p style={{ margin: 0, opacity: 0.75 }}>
              Two compute passes: multiply by 2, then add 1.
            </p>
          </div>
          <Link to="/" title="Go to examples">
            Examples
          </Link>
        </div>

        <div
          style={{
            marginTop: 24,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 20,
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
            Status
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{status}</div>

          {error && (
            <div style={{ marginTop: 12, color: "#ff9a9a" }}>{error}</div>
          )}

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <div>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
                Input
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "rgba(0,0,0,0.4)",
                  borderRadius: 8,
                }}
              >
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
                Output
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "rgba(0,0,0,0.4)",
                  borderRadius: 8,
                }}
              >
                {output ? JSON.stringify(output, null, 2) : "Waiting..."}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
