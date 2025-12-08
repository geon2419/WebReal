import { Color } from "@web-real/math";
import type { Engine } from "./Engine";
import type { Scene } from "./Scene";
import type { Camera } from "./camera/Camera";
import type { Material, RenderContext } from "./material/Material";
import { Mesh } from "./Mesh";

interface MeshGPUResources {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  materialType: string;
  topology: GPUPrimitiveTopology;
  indexCount: number;
}

/**
 * Handles WebGPU rendering for scenes.
 * Manages render pipelines, GPU buffers, and depth textures.
 */
export class Renderer {
  private engine: Engine;
  private depthTexture!: GPUTexture;
  private msaaTexture!: GPUTexture;
  private clearColor: Color = new Color(0.1, 0.1, 0.1, 1.0);
  private resizeObserver: ResizeObserver;
  private sampleCount: number = 4; // 4x MSAA

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
    this.createMSAATexture();

    this.resizeObserver = new ResizeObserver(() => {
      this.createDepthTexture();
      this.createMSAATexture();
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
      sampleCount: this.sampleCount,
    });
  }

  private createMSAATexture(): void {
    if (this.msaaTexture) {
      this.msaaTexture.destroy();
    }

    const canvas = this.engine.canvas;
    this.msaaTexture = this.device.createTexture({
      size: [canvas.width, canvas.height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this.sampleCount,
    });
  }

  /**
   * Gets or creates a render pipeline for the given material.
   * @param material - The material to create a pipeline for.
   * @returns The cached or newly created render pipeline.
   */
  private getOrCreatePipeline(material: Material): GPURenderPipeline {
    const topology = material.getPrimitiveTopology();
    const key = `${material.type}_${topology}`;
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
          topology,
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
        multisample: {
          count: this.sampleCount,
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
    const currentMaterialType = mesh.material.type;
    const currentTopology = mesh.material.getPrimitiveTopology();

    // Invalidate resources if material type, topology changed, or mesh needs update
    if (
      resources &&
      (resources.materialType !== currentMaterialType ||
        resources.topology !== currentTopology ||
        mesh.needsUpdate)
    ) {
      resources.vertexBuffer.destroy();
      resources.indexBuffer.destroy();
      resources.uniformBuffer.destroy();
      resources = undefined;
      mesh.needsUpdate = false;
    }

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

      // Use wireframe indices if topology is line-list, otherwise use regular indices
      const indexData =
        currentTopology === "line-list"
          ? mesh.getWireframeIndices()
          : mesh.indices;
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

      // Create bind group entries based on material type
      const bindGroupEntries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
      ];

      // Add texture and sampler for materials with texture support
      if (mesh.material.getTextures) {
        const textures = mesh.material.getTextures(this.device);

        if (textures.length > 0) {
          // Use shared sampler for all textures (binding 1)
          bindGroupEntries.push({
            binding: 1,
            resource: textures[0].gpuSampler,
          });

          // Bind each texture starting from binding 2
          textures.forEach((texture, index) => {
            bindGroupEntries.push({
              binding: 2 + index,
              resource: texture.gpuTexture.createView(),
            });
          });
        }
      }

      const bindGroup = this.device.createBindGroup({
        label: "Mesh Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: bindGroupEntries,
      });

      resources = {
        vertexBuffer,
        indexBuffer,
        uniformBuffer,
        bindGroup,
        materialType: currentMaterialType,
        topology: currentTopology,
        indexCount: indexData.length,
      };
      this.meshBuffers.set(mesh, resources);
      this.trackedMeshes.add(mesh);
    }

    return resources;
  }

  /**
   * Sets the clear color for the render pass.
   * @param color - Color instance or RGBA tuple [r, g, b] or [r, g, b, a].
   * @returns This renderer for chaining.
   */
  setClearColor(
    color: Color | [number, number, number] | [number, number, number, number]
  ): this {
    this.clearColor = Color.from(color);
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
      if (object instanceof Mesh && object.visible) {
        meshes.push(object);
      }
    });

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: this.msaaTexture.createView(),
          resolveTarget: textureView,
          clearValue: {
            r: this.clearColor.r,
            g: this.clearColor.g,
            b: this.clearColor.b,
            a: this.clearColor.a,
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

      // Compute MVP(Model, View, Projection) matrix
      const mvpMatrix = camera.projectionMatrix
        .multiply(camera.viewMatrix)
        .multiply(mesh.worldMatrix);

      // Write MVP matrix directly
      this.device.queue.writeBuffer(
        resources.uniformBuffer,
        0,
        mvpMatrix.data as Float32Array<ArrayBuffer>
      );

      // Write material-specific data using writeUniformData method
      if (material.writeUniformData) {
        // Create render context for materials that need it
        const renderContext: RenderContext = {
          camera,
          scene,
          mesh,
        };

        // Use pre-allocated buffer from material if available, otherwise allocate temporarily
        const uniformData =
          "getUniformDataBuffer" in material &&
          typeof material.getUniformDataBuffer === "function"
            ? material.getUniformDataBuffer()
            : new ArrayBuffer(material.getUniformBufferSize());
        const dataView = new DataView(uniformData);

        // Call material's writeUniformData method
        material.writeUniformData(dataView, 64, renderContext);

        // Write the uniform data to GPU (starting at offset 64, after MVP)
        const customDataSize = material.getUniformBufferSize() - 64;
        if (customDataSize > 0) {
          this.device.queue.writeBuffer(
            resources.uniformBuffer,
            64,
            uniformData,
            64, // source offset - read from offset 64 where material wrote its data
            customDataSize // size to copy
          );
        }
      }

      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, resources.bindGroup);
      passEncoder.setVertexBuffer(0, resources.vertexBuffer);

      // Use draw() for non-indexed geometry (e.g., lines), drawIndexed() otherwise
      if (resources.indexCount > 0) {
        passEncoder.setIndexBuffer(resources.indexBuffer, "uint16");
        passEncoder.drawIndexed(resources.indexCount);
      } else {
        passEncoder.draw(mesh.vertexCount);
      }
    }

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Cleans up GPU resources and disconnects observers.
   * Call this method when the renderer is no longer needed to prevent memory leaks.
   */
  dispose(): void {
    this.resizeObserver.disconnect();

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    if (this.msaaTexture) {
      this.msaaTexture.destroy();
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
