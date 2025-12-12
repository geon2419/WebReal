import { Color } from "@web-real/math";
import type { Engine } from "./Engine";
import type { Scene } from "./scene/Scene";
import type { Camera } from "./camera/Camera";
import type { Material, RenderContext } from "./material/Material";
import { PBRMaterial } from "./material/PBRMaterial";
import { SkyboxMaterial } from "./material/SkyboxMaterial";
import { Mesh } from "./scene/Mesh";
import { Light } from "./light/Light";
import { getIndexFormat } from "./geometry/Geometry";

interface MeshGPUResources {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  iblBindGroup?: GPUBindGroup;
  materialType: string;
  topology: GPUPrimitiveTopology;
  indexCount: number;
  indexFormat: GPUIndexFormat;
}

interface SkyboxGPUResources {
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  material: SkyboxMaterial;
  bindingRevision: number;
}

/**
 * Handles WebGPU rendering for scenes with MSAA support.
 * Manages render pipelines, GPU buffers, depth textures, and material-based rendering.
 *
 * @example
 * ```ts
 * const engine = new Engine(canvas);
 * const renderer = new Renderer(engine);
 * renderer.setClearColor([0.2, 0.3, 0.4, 1.0]);
 * renderer.render(scene, camera);
 * ```
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

  // Skybox rendering resources
  private skyboxResources?: SkyboxGPUResources;

  // Dummy textures for IBL bind group when IBL is not used
  private _dummyCubeTexture?: GPUTexture;
  private _dummyBrdfLUT?: GPUTexture;

  /**
   * Creates a new Renderer instance with 4x MSAA and depth buffering.
   * @param engine - The Engine instance providing WebGPU device and canvas context
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
   * Creates or returns a cached dummy cube texture for IBL bind groups.
   * Used when PBRMaterial doesn't have IBL textures but shader requires bind group.
   */
  private getDummyCubeTexture(): GPUTexture {
    if (!this._dummyCubeTexture) {
      this._dummyCubeTexture = this.device.createTexture({
        label: "Dummy IBL Cube Texture",
        size: [1, 1, 6],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING,
        dimension: "2d",
      });
    }
    return this._dummyCubeTexture;
  }

  /**
   * Creates or returns a cached dummy BRDF LUT texture for IBL bind groups.
   * Used when PBRMaterial doesn't have IBL textures but shader requires bind group.
   */
  private getDummyBrdfLUT(): GPUTexture {
    if (!this._dummyBrdfLUT) {
      this._dummyBrdfLUT = this.device.createTexture({
        label: "Dummy BRDF LUT",
        size: [1, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING,
        dimension: "2d",
      });
    }
    return this._dummyBrdfLUT;
  }

  /**
   * Gets or creates a render pipeline for the given material with caching.
   * @param material - The material defining shaders and rendering configuration
   * @returns The cached or newly created render pipeline for this material type
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
   * Gets or creates GPU buffers and bind groups for the given mesh.
   * @param mesh - The mesh requiring vertex, index, and uniform buffers
   * @param pipeline - The render pipeline used to create compatible bind groups
   * @returns The cached or newly created GPU resources for this mesh
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
      const indexFormat = getIndexFormat(indexData);
      const indexBuffer = this.device.createBuffer({
        label: "Mesh Index Buffer",
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(
        indexBuffer,
        0,
        indexData instanceof Uint32Array
          ? (indexData as Uint32Array<ArrayBuffer>)
          : (indexData as Uint16Array<ArrayBuffer>)
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

      // Create IBL bind group for PBR materials
      // Always create bind group because shader declares @group(1) even when not using IBL
      let iblBindGroup: GPUBindGroup | undefined;
      if (mesh.material instanceof PBRMaterial) {
        const iblTextures = mesh.material.getIBLTextures(this.device);

        if (iblTextures) {
          // Real IBL textures available
          iblBindGroup = this.device.createBindGroup({
            label: "IBL Bind Group",
            layout: pipeline.getBindGroupLayout(1),
            entries: [
              {
                binding: 0,
                resource: iblTextures.prefilteredMap.gpuSampler,
              },
              {
                binding: 1,
                resource: iblTextures.prefilteredMap.cubeView,
              },
              {
                binding: 2,
                resource: iblTextures.irradianceMap.cubeView,
              },
              {
                binding: 3,
                resource: iblTextures.brdfLUT.gpuTexture.createView(),
              },
            ],
          });
        } else {
          // No IBL textures - create dummy bind group to satisfy shader requirements
          const dummyCube = this.getDummyCubeTexture();
          const dummyBrdf = this.getDummyBrdfLUT();
          const dummySampler = this.device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
          });

          iblBindGroup = this.device.createBindGroup({
            label: "Dummy IBL Bind Group",
            layout: pipeline.getBindGroupLayout(1),
            entries: [
              {
                binding: 0,
                resource: dummySampler,
              },
              {
                binding: 1,
                resource: dummyCube.createView({ dimension: "cube" }),
              },
              {
                binding: 2,
                resource: dummyCube.createView({ dimension: "cube" }),
              },
              {
                binding: 3,
                resource: dummyBrdf.createView(),
              },
            ],
          });
        }
      }

      resources = {
        vertexBuffer,
        indexBuffer,
        uniformBuffer,
        bindGroup,
        iblBindGroup,
        materialType: currentMaterialType,
        topology: currentTopology,
        indexCount: indexData.length,
        indexFormat,
      };
      this.meshBuffers.set(mesh, resources);
      this.trackedMeshes.add(mesh);
    }

    return resources;
  }

  /**
   * Creates or updates GPU resources for skybox rendering.
   * @param material - The skybox material to render
   * @returns GPU resources for skybox rendering
   */
  private getOrCreateSkyboxResources(
    material: SkyboxMaterial
  ): SkyboxGPUResources {
    // Invalidate if material changed
    if (this.skyboxResources && this.skyboxResources.material !== material) {
      this.skyboxResources.uniformBuffer.destroy();
      this.skyboxResources = undefined;
    }

    // Same material instance, but bindings have changed (e.g., env map switched).
    // Rebuild bind group only; keep pipeline and uniform buffer.
    if (
      this.skyboxResources &&
      this.skyboxResources.material === material &&
      this.skyboxResources.bindingRevision !== material.bindingRevision
    ) {
      const textures = material.getTextures(this.device);
      const cubeTexture = material.getCubeTexture();

      const bindGroupEntries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: { buffer: this.skyboxResources.uniformBuffer },
        },
        { binding: 1, resource: textures[0].gpuSampler },
        { binding: 2, resource: textures[0].gpuTexture.createView() }, // equirect
      ];

      if (cubeTexture) {
        bindGroupEntries.push({
          binding: 3,
          resource: cubeTexture.cubeView,
        });
      } else {
        bindGroupEntries.push({
          binding: 3,
          resource: this.getDummyCubeTexture().createView({
            dimension: "cube",
          }),
        });
      }

      this.skyboxResources.bindGroup = this.device.createBindGroup({
        label: "Skybox Bind Group",
        layout: this.skyboxResources.pipeline.getBindGroupLayout(0),
        entries: bindGroupEntries,
      });
      this.skyboxResources.bindingRevision = material.bindingRevision;
    }

    if (!this.skyboxResources) {
      // Create skybox pipeline with special depth settings
      const vertexShaderModule = this.device.createShaderModule({
        label: "Skybox Vertex Shader",
        code: material.getVertexShader(),
      });

      const fragmentShaderModule = this.device.createShaderModule({
        label: "Skybox Fragment Shader",
        code: material.getFragmentShader(),
      });

      const pipeline = this.device.createRenderPipeline({
        label: "Skybox Pipeline",
        layout: "auto",
        vertex: {
          module: vertexShaderModule,
          entryPoint: "main",
          // No vertex buffers - fullscreen triangle generated in shader
        },
        fragment: {
          module: fragmentShaderModule,
          entryPoint: "main",
          targets: [{ format: this.format }],
        },
        primitive: {
          topology: "triangle-list",
          // No culling for skybox
          cullMode: "none",
        },
        depthStencil: {
          // No depth write - skybox rendered first at z=1
          depthWriteEnabled: false,
          // Skybox passes when depth is less-equal (z=1 passes initially)
          depthCompare: "less-equal",
          format: "depth24plus",
        },
        multisample: {
          count: this.sampleCount,
        },
      });

      const uniformBuffer = this.device.createBuffer({
        label: "Skybox Uniform Buffer",
        size: material.getUniformBufferSize(),
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      // Create bind group with textures
      const textures = material.getTextures(this.device);
      const cubeTexture = material.getCubeTexture();

      const bindGroupEntries: GPUBindGroupEntry[] = [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: textures[0].gpuSampler },
        { binding: 2, resource: textures[0].gpuTexture.createView() }, // equirect
      ];

      // Add cubemap view
      if (cubeTexture) {
        bindGroupEntries.push({
          binding: 3,
          resource: cubeTexture.cubeView,
        });
      } else {
        bindGroupEntries.push({
          binding: 3,
          resource: this.getDummyCubeTexture().createView({
            dimension: "cube",
          }),
        });
      }

      const bindGroup = this.device.createBindGroup({
        label: "Skybox Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: bindGroupEntries,
      });

      this.skyboxResources = {
        pipeline,
        uniformBuffer,
        bindGroup,
        material,
        bindingRevision: material.bindingRevision,
      };
    }

    return this.skyboxResources;
  }

  /**
   * Renders the skybox as background.
   * @param passEncoder - The render pass encoder
   * @param material - The skybox material
   * @param camera - The camera for view-projection calculation
   */
  private renderSkybox(
    passEncoder: GPURenderPassEncoder,
    material: SkyboxMaterial,
    camera: Camera
  ): void {
    const resources = this.getOrCreateSkyboxResources(material);

    // Write uniform data
    const uniformData = new ArrayBuffer(material.getUniformBufferSize());
    const dataView = new DataView(uniformData);

    // Create minimal render context for skybox
    const renderContext: RenderContext = {
      camera,
      scene: null as any, // Skybox doesn't need scene
      mesh: null as any, // Skybox doesn't need mesh
      lights: [],
    };

    material.writeUniformData(dataView, 0, renderContext);

    this.device.queue.writeBuffer(resources.uniformBuffer, 0, uniformData);

    passEncoder.setPipeline(resources.pipeline);
    passEncoder.setBindGroup(0, resources.bindGroup);
    // Draw fullscreen triangle (3 vertices, no vertex buffer)
    passEncoder.draw(3);
  }

  /**
   * Sets the clear color for the render pass.
   * @param color - Color instance or RGB/RGBA tuple [r, g, b] or [r, g, b, a] (values 0-1)
   * @returns This renderer instance for method chaining
   */
  setClearColor(
    color: Color | [number, number, number] | [number, number, number, number]
  ): this {
    this.clearColor = Color.from(color);
    return this;
  }

  /**
   * Renders a scene from the perspective of a camera with lighting and materials.
   * @param scene - The scene containing meshes and lights to render
   * @param camera - The camera defining view and projection transforms
   */
  render(scene: Scene, camera: Camera): void {
    scene.updateMatrixWorld();
    camera.updateWorldMatrix(false, false);

    // Collect meshes and lights in a single traversal
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

    // Render skybox first (if scene has environment)
    if (scene.skyboxMaterial) {
      this.renderSkybox(passEncoder, scene.skyboxMaterial, camera);
    }

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
          lights,
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

      // Set IBL bind group for PBR materials with IBL enabled
      if (resources.iblBindGroup) {
        passEncoder.setBindGroup(1, resources.iblBindGroup);
      }

      passEncoder.setVertexBuffer(0, resources.vertexBuffer);

      // Use draw() for non-indexed geometry (e.g., lines), drawIndexed() otherwise
      if (resources.indexCount > 0) {
        passEncoder.setIndexBuffer(
          resources.indexBuffer,
          resources.indexFormat
        );
        passEncoder.drawIndexed(resources.indexCount);
      } else {
        passEncoder.draw(mesh.vertexCount);
      }
    }

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Cleans up GPU resources and disconnects observers to prevent memory leaks.
   * Destroys textures, buffers, and clears caches for all tracked meshes.
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
