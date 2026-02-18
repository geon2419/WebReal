import {
  Engine,
  InstancedMesh,
  OrbitCameraController,
  PerspectiveCamera,
  Renderer,
  Scene,
} from "@web-real/core";
import { Vector3 } from "@web-real/math";

import { NodeDataLoader, type NodeData } from "./NodeDataLoader";
import { GraphDomainUtils } from "./GraphDomainUtils";
import { NodeMeshFactory } from "./NodeMeshFactory";
import { NodeSimulation, type SimulationParams } from "./NodeSimulation";
import {
  ControlPanel,
  type GraphControlsCallbacks,
  type GraphControlsParams,
} from "./ControlPanel";

export interface GraphControllerOptions {
  canvas: HTMLCanvasElement;
  statsElement?: HTMLElement | null;
}

export class GraphController {
  private _canvas: HTMLCanvasElement;
  private _statsElement: HTMLElement | null;

  private _engine: Engine | null = null;
  private _renderer: Renderer | null = null;
  private _scene: Scene | null = null;
  private _camera: PerspectiveCamera | null = null;
  private _orbit: OrbitCameraController | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  private _mesh: InstancedMesh | null = null;
  private _simulation: NodeSimulation | null = null;
  private _nodes: NodeData[] = [];

  private _disposed = false;
  private _reinitializing = false;
  private _reinitVersion = 0;
  private _loadAbort: AbortController | null = null;

  private _controlPanelParams: GraphControlsParams;
  private _controlPanel: { destroy: () => void } | null = null;

  // Stats
  private _frameCount = 0;
  private _lastTime = performance.now();

  private _instanceScale = 0.01;

  constructor(options: GraphControllerOptions) {
    this._canvas = options.canvas;
    this._statsElement = options.statsElement ?? null;

    this._controlPanelParams = {
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
  }

  async init(): Promise<void> {
    try {
      this._engine = await Engine.create({
        canvas: this._canvas,
        requiredFeatures: ["timestamp-query"],
      });

      this._renderer = new Renderer(this._engine);
      this._renderer.setClearColor([0.05, 0.05, 0.05, 1]);

      this._scene = new Scene();

      this._camera = new PerspectiveCamera({
        fov: 60,
        near: 0.1,
        far: 1000,
      });

      this._orbit = new OrbitCameraController(this._camera, this._canvas, {
        target: new Vector3(0, 0, 0),
        radius: 4,
        theta: 0,
        phi: Math.PI / 2,
      });

      this._camera.updateAspect(this._canvas);
      this._resizeObserver = new ResizeObserver(() => {
        if (!this._camera) return;
        const rect = this._canvas.getBoundingClientRect();
        this._camera.aspect =
          Math.max(1e-6, rect.width) / Math.max(1e-6, rect.height);
      });
      this._resizeObserver.observe(this._canvas);

      const nodes = await this._loadNodes();
      this._initGraph(nodes);

      const graphControlsCallbacks: GraphControlsCallbacks = {
        onNodeCountChange: async (count: number) => {
          this._controlPanelParams.nodeCount = Math.min(count, 203771);
          await this.reinit();
        },
        onSpaceScaleChange: async (scale: number) => {
          this._controlPanelParams.spaceScale = scale;
          if (this._orbit) {
            this._orbit.radius = Math.max(this._orbit.radius, 4 * scale);
            this._orbit.update();
          }
          await this.reinit();
        },
        onNodeSizeChange: (size: number) => {
          this._controlPanelParams.nodeSize = size;
          this._instanceScale = size;
          if (this._mesh) {
            this._mesh.instanceSize = size;
          }
        },
      };

      this._controlPanel = ControlPanel.createGraphControls(
        this._controlPanelParams,
        graphControlsCallbacks,
      );

      this._engine.run((deltaTime) => {
        if (this._disposed) {
          return;
        }

        if (this._reinitializing) {
          return;
        }

        this.tick(deltaTime);
      });

      if (this._statsElement) {
        this._statsElement.textContent = "Loading...";
      }

      console.log("Initialization complete");
    } catch (error) {
      console.error("Failed to initialize:", error);
      if (this._statsElement) {
        this._statsElement.textContent =
          error instanceof Error ? error.message : "Initialization failed";
      }
    }
  }

  private async _loadNodes(): Promise<NodeData[]> {
    this._loadAbort?.abort();
    this._loadAbort = new AbortController();

    const nodes = await NodeDataLoader.loadNodeData(
      this._controlPanelParams.nodeCount,
      this._controlPanelParams.spaceScale,
      {
        signal: this._loadAbort.signal,
      },
    );

    this._nodes = nodes;
    this._instanceScale = this._controlPanelParams.nodeSize;

    return nodes;
  }

  private _initGraph(nodes: NodeData[]): void {
    if (!this._engine || !this._scene) return;

    this._mesh = NodeMeshFactory.createNodeMesh(nodes, {
      instanceSize: this._controlPanelParams.nodeSize,
      getInstanceScale: () => this._instanceScale,
    });

    NodeMeshFactory.applyNodesToMesh(this._mesh, nodes);
    this._scene.add(this._mesh);

    this._simulation = new NodeSimulation(this._engine.device, nodes.length);
    const storageBuffer = this._mesh.getStorageBuffer(this._engine.device);
    this._simulation.createBindGroup(storageBuffer);
  }

  async reinit(): Promise<void> {
    if (this._disposed) {
      return;
    }

    if (!this._engine || !this._scene) {
      return;
    }

    const myVersion = ++this._reinitVersion;
    this._reinitializing = true;

    try {
      if (this._mesh) {
        this._mesh.dispose();
        this._scene.remove(this._mesh);
        this._mesh = null;
      }
      if (this._simulation) {
        this._simulation.dispose();
        this._simulation = null;
      }

      // Newer reinit call supersedes older ones.
      if (this._disposed || myVersion !== this._reinitVersion) {
        return;
      }

      const nodes = await this._loadNodes();
      this._initGraph(nodes);

      if (this._disposed || myVersion !== this._reinitVersion) {
        return;
      }

      console.log(`Reinitialized with ${this._nodes.length} nodes`);
    } catch (error) {
      // Aborts are expected during rapid UI changes.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Reinit failed:", error);

      if (this._statsElement) {
        this._statsElement.textContent =
          error instanceof Error ? error.message : "Reinit failed";
      }
    } finally {
      if (myVersion === this._reinitVersion) {
        this._reinitializing = false;
      }
    }
  }

  tick(deltaTime: number): void {
    if (!this._engine || !this._renderer || !this._scene || !this._camera) {
      return;
    }

    if (this._controlPanelParams.running && this._simulation) {
      const simParams: SimulationParams = {
        repulsionStrength: this._controlPanelParams.repulsionStrength,
        centerGravity: this._controlPanelParams.centerGravity,
        damping: this._controlPanelParams.damping,
        deltaTime: Math.min(deltaTime, 0.033),
        bounds: GraphDomainUtils.getSimulationBounds(
          this._controlPanelParams.spaceScale,
        ),
      };

      this._simulation.updateParams(simParams);

      const commandEncoder = this._engine.device.createCommandEncoder();
      this._simulation.compute(commandEncoder);
      this._engine.device.queue.submit([commandEncoder.finish()]);
    }

    this._renderer.render(this._scene, this._camera);

    this._updateStats();
  }

  private _updateStats(): void {
    if (!this._statsElement) {
      return;
    }

    this._frameCount++;
    const now = performance.now();

    if (now - this._lastTime >= 1000) {
      const fps = (this._frameCount / (now - this._lastTime)) * 1000;
      this._statsElement.textContent = `FPS: ${fps.toFixed(1)} | Nodes: ${this._nodes.length}`;
      this._frameCount = 0;
      this._lastTime = now;
    }
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._reinitializing = true;

    this._loadAbort?.abort();
    this._loadAbort = null;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
    if (this._orbit) {
      this._orbit.dispose();
    }

    try {
      this._engine?.stop();
    } catch {
      // ignore
    }

    if (this._simulation) {
      this._simulation.dispose();
    }
    if (this._mesh) {
      this._mesh.dispose();
    }
    if (this._renderer) {
      this._renderer.dispose();
    }
    if (this._controlPanel) {
      this._controlPanel.destroy();
    }

    try {
      this._camera?.dispose();
      this._engine?.dispose();
    } catch {
      // ignore
    }

    this._simulation = null;
    this._mesh = null;
    this._renderer = null;
    this._scene = null;
    this._camera = null;
    this._engine = null;
    this._orbit = null;
    this._controlPanel = null;
    this._resizeObserver = null;
  }
}
