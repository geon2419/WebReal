import { useEffect, useRef } from "react";
import {
  Engine,
  Renderer,
  Scene,
  PerspectiveCamera,
  OrbitCameraController,
  SphereGeometry,
  ShaderMaterial,
  InstancedMesh,
} from "@web-real/core";
import { Vector3 } from "@web-real/math";
import { loadNodeData, getNodeColor, type NodeData } from "./dataLoader";
import { NodeSimulation, type SimulationParams } from "./simulation";
import { createUI, type UIParams, type UICallbacks } from "./ui";
import { instancedVertexShader, instancedFragmentShader } from "./shaders";

type NodeClassCode = 0 | 1 | 2; // 0=unknown, 1=illicit, 2=licit

interface NodeIndexTables {
  txIdToIndex: Map<number, number>;
  indexToTxId: Uint32Array;
  indexToClass: Uint8Array;
}

function buildNodeIndexTables(nodes: NodeData[]): NodeIndexTables {
  const txIdToIndex = new Map<number, number>();
  const indexToTxId = new Uint32Array(nodes.length);
  const indexToClass = new Uint8Array(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    txIdToIndex.set(n.id, i);
    indexToTxId[i] = n.id >>> 0;

    let cls: NodeClassCode = 0;
    if (n.class === 1) cls = 1;
    else if (n.class === 2) cls = 2;
    indexToClass[i] = cls;
  }

  return { txIdToIndex, indexToTxId, indexToClass };
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  // Future-proof tables for edges/picking/filters.
  const nodeIndexRef = useRef<NodeIndexTables | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    let engine: Engine;
    let renderer: Renderer;
    let scene: Scene;
    let camera: PerspectiveCamera;
    let orbit: OrbitCameraController | null = null;
    let mesh: InstancedMesh;
    let simulation: NodeSimulation;
    let nodes: NodeData[] = [];
    let disposed = false;
    let isReinitializing = false;
    let gui: { destroy: () => void } | null = null;
    let instanceScale = 0.01;
    let resizeObserver: ResizeObserver | null = null;

    // UI parameters
    const uiParams: UIParams = {
      nodeCount: 1000,
      running: true,
      spaceScale: 1,
      repulsionStrength: 0.05,
      centerGravity: 0.01,
      damping: 0.95,
      nodeSize: 0.01,
      showIllicit: true,
      showLicit: true,
      showUnknown: true,
    };

    const getBounds = (): [number, number, number] => {
      const s = Math.max(0.1, uiParams.spaceScale);
      // Keep previous shape ratio (Z a bit deeper than XY)
      return [0.95 * s, 0.95 * s, 1.5 * s];
    };

    async function init() {
      try {
        // Initialize WebGPU engine
        engine = await Engine.create({
          canvas,
          requiredFeatures: ["timestamp-query"],
        });

        renderer = new Renderer(engine);
        renderer.setClearColor([0.05, 0.05, 0.05, 1]);

        scene = new Scene();

        // Perspective camera for 3D view
        camera = new PerspectiveCamera({
          fov: 60,
          near: 0.1,
          far: 1000,
        });

        // Orbit controls (left-drag rotate, right-drag pan, wheel zoom)
        orbit = new OrbitCameraController(camera, canvas, {
          target: new Vector3(0, 0, 0),
          radius: 4,
          theta: 0,
          phi: Math.PI / 2,
        });

        // Keep aspect ratio in sync with canvas size.
        camera.updateAspect(canvas);
        // Extra safety: update aspect from CSS size (works even if canvas.width/height lags).
        resizeObserver = new ResizeObserver(() => {
          const rect = canvas.getBoundingClientRect();
          camera.aspect = Math.max(1e-6, rect.width) / Math.max(1e-6, rect.height);
        });
        resizeObserver.observe(canvas);

        // Load node data
        nodes = await loadNodeData(uiParams.nodeCount, uiParams.spaceScale);
        nodeIndexRef.current = buildNodeIndexTables(nodes);

        instanceScale = uiParams.nodeSize;

        // Create sphere geometry (low-poly for performance)
        const geometry = new SphereGeometry({
          radius: 1,
          widthSegments: 6,
          heightSegments: 4,
        });

        // Create custom material for instanced rendering
        const material = new ShaderMaterial({
          vertexShader: instancedVertexShader,
          fragmentShader: instancedFragmentShader,
          // MVP(64) + instanceScale(vec4=16)
          uniformBufferSize: 80,
          writeUniformData: (buffer, offset = 64) => {
            buffer.setFloat32(offset + 0, instanceScale, true);
            buffer.setFloat32(offset + 4, 0, true);
            buffer.setFloat32(offset + 8, 0, true);
            buffer.setFloat32(offset + 12, 0, true);
          },
        });

        // Create instanced mesh
        mesh = new InstancedMesh(geometry, material, nodes.length, {
          mode: "position",
          instanceSize: uiParams.nodeSize,
        });

        // Set initial positions and colors
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          mesh.setPositionAt(i, node.x, node.y, node.z);

          const color = getNodeColor(node.class);
          mesh.setColorAt(i, color[0], color[1], color[2], 1);
        }

        scene.add(mesh);

        // Create simulation
        simulation = new NodeSimulation(engine.device, nodes.length);
        const storageBuffer = mesh.getStorageBuffer(engine.device);
        simulation.createBindGroup(storageBuffer);

        // Create UI
        const callbacks: UICallbacks = {
          onNodeCountChange: async (count: number) => {
            uiParams.nodeCount = Math.min(count, 203771);
            await reinitialize();
          },
          onSpaceScaleChange: async (scale: number) => {
            uiParams.spaceScale = scale;
            // Keep camera framing reasonable when space expands.
            if (orbit) {
              orbit.radius = Math.max(orbit.radius, 4 * scale);
              // Apply the new radius immediately so it doesn't "jump" on the next input.
              orbit.update();
            }
            await reinitialize();
          },
          onNodeSizeChange: (size: number) => {
            instanceScale = size;
            // keep this for potential future use; our shader uses instanceScale
            mesh.instanceSize = size;
          },
        };

        gui = createUI(uiParams, callbacks);

        // Start render loop
        let frameCount = 0;
        let lastTime = performance.now();

        engine.run((deltaTime) => {
          if (disposed) return;
          if (isReinitializing) return;

          // Update simulation
          if (uiParams.running) {
            const simParams: SimulationParams = {
              repulsionStrength: uiParams.repulsionStrength,
              centerGravity: uiParams.centerGravity,
              damping: uiParams.damping,
              // clamp for stability on tab-switch / long frames
              deltaTime: Math.min(deltaTime, 0.033),
              bounds: getBounds(),
            };

            simulation.updateParams(simParams);

            const commandEncoder = engine.device.createCommandEncoder();
            simulation.compute(commandEncoder);
            engine.device.queue.submit([commandEncoder.finish()]);
          }

          // Render scene
          renderer.render(scene, camera);

          // Update stats
          frameCount++;
          const now = performance.now();
          if (now - lastTime >= 1000) {
            const fps = (frameCount / (now - lastTime)) * 1000;
            if (statsRef.current) {
              statsRef.current.textContent = `FPS: ${fps.toFixed(1)} | Nodes: ${nodes.length}`;
            }
            frameCount = 0;
            lastTime = now;
          }
        });

        console.log("Initialization complete");
      } catch (error) {
        console.error("Failed to initialize:", error);
      }
    }

    async function reinitialize() {
      if (disposed) return;
      isReinitializing = true;

      // Clean up existing resources
      if (mesh) {
        mesh.dispose();
        scene.remove(mesh);
      }
      if (simulation) {
        simulation.dispose();
      }

      // Reload with new node count
      nodes = await loadNodeData(uiParams.nodeCount, uiParams.spaceScale);
      nodeIndexRef.current = buildNodeIndexTables(nodes);

      instanceScale = uiParams.nodeSize;

      const geometry = new SphereGeometry({
        radius: 1,
        widthSegments: 6,
        heightSegments: 4,
      });

      const material = new ShaderMaterial({
        vertexShader: instancedVertexShader,
        fragmentShader: instancedFragmentShader,
        uniformBufferSize: 80,
        writeUniformData: (buffer, offset = 64) => {
          buffer.setFloat32(offset + 0, instanceScale, true);
          buffer.setFloat32(offset + 4, 0, true);
          buffer.setFloat32(offset + 8, 0, true);
          buffer.setFloat32(offset + 12, 0, true);
        },
      });

      mesh = new InstancedMesh(geometry, material, nodes.length, {
        mode: "position",
        instanceSize: uiParams.nodeSize,
      });

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        mesh.setPositionAt(i, node.x, node.y, node.z);

        const color = getNodeColor(node.class);
        mesh.setColorAt(i, color[0], color[1], color[2], 1);
      }

      scene.add(mesh);

      simulation = new NodeSimulation(engine.device, nodes.length);
      const storageBuffer = mesh.getStorageBuffer(engine.device);
      simulation.createBindGroup(storageBuffer);

      console.log(`Reinitialized with ${nodes.length} nodes`);
      isReinitializing = false;
    }

    init();

    return () => {
      disposed = true;
      isReinitializing = true;
      if (resizeObserver) resizeObserver.disconnect();
      if (orbit) orbit.dispose();
      try {
        engine?.stop();
      } catch {
        // ignore
      }
      if (simulation) simulation.dispose();
      if (mesh) mesh.dispose();
      if (renderer) renderer.dispose();
      if (gui) gui.destroy();
      try {
        camera?.dispose();
        engine?.dispose();
      } catch {
        // ignore
      }
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
    </div>
  );
}

export default App;
