import { Color } from "@web-real/math";
import type { Engine } from "../Engine";
import type { Camera } from "../camera/Camera";
import { Light } from "../light/Light";
import { Mesh } from "../scene/Mesh";
import type { Scene } from "../scene/Scene";
import { FallbackResources } from "./FallbackResources";
import { MeshPass } from "./MeshPass";
import { MeshResourceCache } from "./MeshResourceCache";
import { PipelineCache } from "./PipelineCache";
import { RenderTargets } from "./RenderTargets";
import { SkyboxPass } from "./SkyboxPass";

/**
 * Renders a scene to the engine canvas using WebGPU.
 *
 * @example
 * ```ts
 * const renderer = new Renderer(engine);
 * renderer.setClearColor([0.1, 0.1, 0.1, 1]);
 * renderer.render(scene, camera);
 * ```
 */
export class Renderer {
  private engine: Engine;
  private clearColor: Color = new Color(0.1, 0.1, 0.1, 1.0);
  private sampleCount: number = 4;

  private _fallback: FallbackResources;
  private _renderTargets: RenderTargets;
  private _pipelines: PipelineCache;
  private _meshResources: MeshResourceCache;
  private _meshPass: MeshPass;
  private _skyboxPass: SkyboxPass;

  /**
   * Creates a new renderer for an engine instance.
   * @param engine - Engine providing the device, canvas context, and swapchain format
   */
  constructor(engine: Engine) {
    this.engine = engine;

    this._fallback = new FallbackResources(this.device);

    this._renderTargets = new RenderTargets({
      device: this.device,
      context: this.context,
      format: this.format,
      canvas: this.engine.canvas,
      sampleCount: this.sampleCount,
    });

    this._pipelines = new PipelineCache({
      device: this.device,
      format: this.format,
      sampleCount: this.sampleCount,
    });

    this._meshResources = new MeshResourceCache({
      device: this.device,
      fallback: this._fallback,
    });

    this._meshPass = new MeshPass({
      device: this.device,
      pipelines: this._pipelines,
      meshResources: this._meshResources,
    });

    this._skyboxPass = new SkyboxPass({
      device: this.device,
      format: this.format,
      sampleCount: this.sampleCount,
      fallback: this._fallback,
    });
  }

  private get device(): GPUDevice {
    return this.engine.device;
  }

  private get context(): GPUCanvasContext {
    return this.engine.context;
  }

  private get format(): GPUTextureFormat {
    return this.engine.format;
  }

  /**
   * Sets the clear color for the next renders.
   * @param color - Clear color as a Color or RGB/RGBA tuple (0..1)
   * @returns This renderer for chaining
   */
  setClearColor(
    color: Color | [number, number, number] | [number, number, number, number]
  ): this {
    this.clearColor = Color.from(color);
    return this;
  }

  /**
   * Renders the scene from the given camera.
   * @param scene - Scene containing meshes, lights, and an optional skybox material
   * @param camera - Camera defining the view and projection
   * @returns Nothing
   */
  render(scene: Scene, camera: Camera): void {
    scene.updateMatrixWorld();
    camera.updateWorldMatrix(false, false);

    const meshes: Mesh[] = [];
    const lights: Light[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh && object.visible) {
        meshes.push(object);
      } else if (object instanceof Light) {
        lights.push(object);
      }
    });

    const commandEncoder = this.device.createCommandEncoder();
    const { passEncoder } = this._renderTargets.beginRenderPass({
      commandEncoder,
      clearColor: this.clearColor,
    });

    if (scene.skyboxMaterial) {
      this._skyboxPass.render(passEncoder, scene.skyboxMaterial, camera);
    }

    this._meshPass.render({
      passEncoder,
      meshes,
      lights,
      scene,
      camera,
    });

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Disposes all GPU resources owned by the renderer.
   */
  dispose(): void {
    this._renderTargets.dispose();
    this._meshResources.disposeAll();
    this._pipelines.clear();
    this._skyboxPass.dispose();
    this._fallback.dispose();
  }

  /**
   * Disposes GPU resources associated with a specific mesh.
   * @param mesh - Mesh to remove from internal caches
   */
  disposeMesh(mesh: Mesh): void {
    this._meshResources.disposeMesh(mesh);
  }
}
