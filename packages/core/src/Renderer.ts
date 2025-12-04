import type { Engine } from "./Engine";
import type { Scene } from "./Scene";
import type { Camera } from "./camera/Camera";
import type { Material } from "./material/Material";
import { BasicMaterial } from "./material/BasicMaterial";
import { Mesh } from "./Mesh";

interface MeshGPUResources {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

/**
 * Handles WebGPU rendering for scenes.
 * Manages render pipelines, GPU buffers, and depth textures.
 */
export class Renderer {
  private engine: Engine;
  private depthTexture!: GPUTexture;
  private clearColor: [number, number, number, number] = [0.1, 0.1, 0.1, 1.0];
  private resizeObserver: ResizeObserver;

  private pipelineCache: Map<string, GPURenderPipeline> = new Map();
  private meshBuffers: WeakMap<Mesh, MeshGPUResources> = new WeakMap();
  private trackedMeshes: Set<Mesh> = new Set();

  /**
   * Creates a new Renderer instance.
   * @param engine - The Engine instance to use for rendering.
   */
  constructor(engine: Engine) {
    this.engine = engine;
    this.createDepthTexture();

    this.resizeObserver = new ResizeObserver(() => {
      this.createDepthTexture();
    });
    this.resizeObserver.observe(this.engine.canvas);
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

  private createDepthTexture(): void {
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    const canvas = this.engine.canvas;
    this.depthTexture = this.device.createTexture({
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  /**
   * Gets or creates a render pipeline for the given material.
   * @param material - The material to create a pipeline for.
   * @returns The cached or newly created render pipeline.
   */
  private getOrCreatePipeline(material: Material): GPURenderPipeline {
    const key = material.type;
    let pipeline = this.pipelineCache.get(key);

    if (!pipeline) {
      const vertexShaderModule = this.device.createShaderModule({
        label: `${material.type} Vertex Shader`,
        code: material.getVertexShader(),
      });

      const fragmentShaderModule = this.device.createShaderModule({
        label: `${material.type} Fragment Shader`,
        code: material.getFragmentShader(),
      });

      const vertexBufferLayout = material.getVertexBufferLayout();

      pipeline = this.device.createRenderPipeline({
        label: `${material.type} Pipeline`,
        layout: "auto",
        vertex: {
          module: vertexShaderModule,
          entryPoint: "main",
          buffers: [
            {
              arrayStride: vertexBufferLayout.arrayStride,
              attributes: vertexBufferLayout.attributes,
            },
          ],
        },
        fragment: {
          module: fragmentShaderModule,
          entryPoint: "main",
          targets: [{ format: this.format }],
        },
        primitive: {
          topology: "triangle-list",
          // Default to back-face culling
          // cullMode: "back",
          // Default to counter-clockwise front face
          // frontFace: "ccw",
        },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: "less",
          format: "depth24plus",
        },
      });

      this.pipelineCache.set(key, pipeline);
    }

    return pipeline;
  }

  /**
   * Gets or creates GPU buffers for the given mesh.
   * @param mesh - The mesh to create buffers for.
   * @param pipeline - The render pipeline to create bind groups with.
   * @returns The cached or newly created GPU resources.
   */
  private getOrCreateMeshBuffers(
    mesh: Mesh,
    pipeline: GPURenderPipeline
  ): MeshGPUResources {
    let resources = this.meshBuffers.get(mesh);

    if (!resources) {
      const vertexData = mesh.getInterleavedVertices();
      const vertexBuffer = this.device.createBuffer({
        label: "Mesh Vertex Buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(
        vertexBuffer,
        0,
        vertexData as Float32Array<ArrayBuffer>
      );

      const indexData = mesh.indices;
      const indexBuffer = this.device.createBuffer({
        label: "Mesh Index Buffer",
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(
        indexBuffer,
        0,
        indexData as Uint16Array<ArrayBuffer>
      );

      const uniformBufferSize = mesh.material.getUniformBufferSize();
      const uniformBuffer = this.device.createBuffer({
        label: "Mesh Uniform Buffer",
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = this.device.createBindGroup({
        label: "Mesh Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      resources = { vertexBuffer, indexBuffer, uniformBuffer, bindGroup };
      this.meshBuffers.set(mesh, resources);
      this.trackedMeshes.add(mesh);
    }

    return resources;
  }

  /**
   * Sets the clear color for the render pass.
   * @param r - Red component (0-1).
   * @param g - Green component (0-1).
   * @param b - Blue component (0-1).
   * @param a - Alpha component (0-1), defaults to 1.0.
   * @returns This renderer for chaining.
   */
  setClearColor(r: number, g: number, b: number, a: number = 1.0): this {
    this.clearColor = [r, g, b, a];
    return this;
  }

  /**
   * Renders a scene from the perspective of a camera.
   * @param scene - The scene to render.
   * @param camera - The camera to render from.
   */
  render(scene: Scene, camera: Camera): void {
    scene.updateMatrixWorld();
    camera.updateWorldMatrix(false, false);

    const meshes: Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        meshes.push(object);
      }
    });

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: {
            r: this.clearColor[0],
            g: this.clearColor[1],
            b: this.clearColor[2],
            a: this.clearColor[3],
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    for (const mesh of meshes) {
      const material = mesh.material;
      const pipeline = this.getOrCreatePipeline(material);
      const resources = this.getOrCreateMeshBuffers(mesh, pipeline);

      const mvpMatrix = camera.projectionMatrix
        .multiply(camera.viewMatrix)
        .multiply(mesh.worldMatrix);

      // Write MVP matrix directly
      this.device.queue.writeBuffer(
        resources.uniformBuffer,
        0,
        mvpMatrix.data as Float32Array<ArrayBuffer>
      );

      // Write material-specific data (if any)
      if (material instanceof BasicMaterial) {
        const colorData = new Float32Array([
          material.color[0],
          material.color[1],
          material.color[2],
          1.0,
        ]);
        this.device.queue.writeBuffer(
          resources.uniformBuffer,
          64,
          colorData as Float32Array<ArrayBuffer>
        );
      }

      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, resources.bindGroup);
      passEncoder.setVertexBuffer(0, resources.vertexBuffer);
      passEncoder.setIndexBuffer(resources.indexBuffer, "uint16");
      passEncoder.drawIndexed(mesh.indexCount);
    }

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  dispose(): void {
    this.resizeObserver.disconnect();

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    for (const mesh of this.trackedMeshes) {
      const resources = this.meshBuffers.get(mesh);
      if (resources) {
        resources.vertexBuffer.destroy();
        resources.indexBuffer.destroy();
        resources.uniformBuffer.destroy();
      }
    }
    this.trackedMeshes.clear();
    this.pipelineCache.clear();
  }
}
