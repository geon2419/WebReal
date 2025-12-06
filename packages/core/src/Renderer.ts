import { Color } from "@web-real/math";
import type { Engine } from "./Engine";
import type { Scene } from "./Scene";
import type { Camera } from "./camera/Camera";
import type { Material } from "./material/Material";
import { BasicMaterial } from "./material/BasicMaterial";
import { BlinnPhongMaterial } from "./material/BlinnPhongMaterial";
import { LineMaterial } from "./material/LineMaterial";
import { ShaderMaterial } from "./material/ShaderMaterial";
import { Mesh } from "./Mesh";
import { DirectionalLight } from "./light/DirectionalLight";
import { PointLight } from "./light/PointLight";
import { Light } from "./light/Light";

interface MeshGPUResources {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  materialType: string;
}

/**
 * Handles WebGPU rendering for scenes.
 * Manages render pipelines, GPU buffers, and depth textures.
 */
export class Renderer {
  private engine: Engine;
  private depthTexture!: GPUTexture;
  private clearColor: Color = new Color(0.1, 0.1, 0.1, 1.0);
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

    // Invalidate resources if material type changed or mesh needs update
    if (
      resources &&
      (resources.materialType !== currentMaterialType || mesh.needsUpdate)
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

      resources = {
        vertexBuffer,
        indexBuffer,
        uniformBuffer,
        bindGroup,
        materialType: currentMaterialType,
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
          view: textureView,
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
      if (
        material instanceof BasicMaterial ||
        material instanceof LineMaterial
      ) {
        const colorData = material.color.toFloat32Array();
        this.device.queue.writeBuffer(
          resources.uniformBuffer,
          64,
          colorData as Float32Array<ArrayBuffer>
        );
      } else if (material instanceof BlinnPhongMaterial) {
        // Write model matrix at offset 64
        this.device.queue.writeBuffer(
          resources.uniformBuffer,
          64,
          mesh.worldMatrix.data as Float32Array<ArrayBuffer>
        );

        // Write normal matrix at offset 128 (inverse transpose of model matrix)
        // This correctly transforms normals even with non-uniform scaling
        const normalMatrix = mesh.worldMatrix.inverse().transpose();
        this.device.queue.writeBuffer(
          resources.uniformBuffer,
          128,
          normalMatrix.data as Float32Array<ArrayBuffer>
        );

        // Write colorAndShininess at offset 192 (rgb = color, a = shininess)
        const colorAndShininessData = new Float32Array([
          material.color.r,
          material.color.g,
          material.color.b,
          material.shininess,
        ]);
        this.device.queue.writeBuffer(
          resources.uniformBuffer,
          192,
          colorAndShininessData as Float32Array<ArrayBuffer>
        );

        // Write light data: offset 208 (lightPosition), 224 (lightColor), 256 (lightParams), 272 (lightTypes)
        let light: Light | undefined;
        scene.traverse((obj) => {
          if (
            (obj instanceof DirectionalLight || obj instanceof PointLight) &&
            !light
          ) {
            light = obj;
          }
        });

        if (light) {
          if (light instanceof DirectionalLight) {
            // Directional light: xyz = direction
            const lightPositionData = new Float32Array([
              light.direction.x,
              light.direction.y,
              light.direction.z,
              0,
            ]);
            this.device.queue.writeBuffer(
              resources.uniformBuffer,
              208,
              lightPositionData as Float32Array<ArrayBuffer>
            );

            // Light params: not used for directional light
            const lightParamsData = new Float32Array([0, 0, 0, 0]);
            this.device.queue.writeBuffer(
              resources.uniformBuffer,
              256,
              lightParamsData as Float32Array<ArrayBuffer>
            );

            // Light types: x = 0 (directional), y = 0 (unused)
            const lightTypesData = new Float32Array([0, 0, 0, 0]);
            this.device.queue.writeBuffer(
              resources.uniformBuffer,
              272,
              lightTypesData as Float32Array<ArrayBuffer>
            );
          } else if (light instanceof PointLight) {
            // Point light: xyz = world position
            light.updateWorldMatrix(true, false);
            const lightPositionData = new Float32Array([
              light.worldMatrix.data[12],
              light.worldMatrix.data[13],
              light.worldMatrix.data[14],
              0,
            ]);
            this.device.queue.writeBuffer(
              resources.uniformBuffer,
              208,
              lightPositionData as Float32Array<ArrayBuffer>
            );

            // Light params: x = range, y = attenuation param
            const attenuationFactors = light.getAttenuationFactors();
            const lightParamsData = new Float32Array([
              attenuationFactors[0], // range
              attenuationFactors[1], // param
              0,
              0,
            ]);
            this.device.queue.writeBuffer(
              resources.uniformBuffer,
              256,
              lightParamsData as Float32Array<ArrayBuffer>
            );

            // Light types: x = 1 (point), y = attenuation type
            const lightTypesData = new Float32Array([
              1, // light type: point
              attenuationFactors[3], // attenuation type
              0,
              0,
            ]);
            this.device.queue.writeBuffer(
              resources.uniformBuffer,
              272,
              lightTypesData as Float32Array<ArrayBuffer>
            );
          }

          // Light color (common for all light types)
          const lightColorData = new Float32Array([
            light.color.r,
            light.color.g,
            light.color.b,
            light.intensity,
          ]);
          this.device.queue.writeBuffer(
            resources.uniformBuffer,
            224,
            lightColorData as Float32Array<ArrayBuffer>
          );
        } else {
          // Default light if none in scene (directional from above)
          const defaultLightPosition = new Float32Array([0, -1, 0, 0]);
          const defaultLightColor = new Float32Array([1, 1, 1, 1]);
          const defaultLightParams = new Float32Array([0, 0, 0, 0]);
          const defaultLightTypes = new Float32Array([0, 0, 0, 0]); // directional
          this.device.queue.writeBuffer(
            resources.uniformBuffer,
            208,
            defaultLightPosition as Float32Array<ArrayBuffer>
          );
          this.device.queue.writeBuffer(
            resources.uniformBuffer,
            224,
            defaultLightColor as Float32Array<ArrayBuffer>
          );
          this.device.queue.writeBuffer(
            resources.uniformBuffer,
            256,
            defaultLightParams as Float32Array<ArrayBuffer>
          );
          this.device.queue.writeBuffer(
            resources.uniformBuffer,
            272,
            defaultLightTypes as Float32Array<ArrayBuffer>
          );
        }

        // Write camera position at offset 240
        const cameraWorldMatrix = camera.worldMatrix.data;
        const cameraPosData = new Float32Array([
          cameraWorldMatrix[12],
          cameraWorldMatrix[13],
          cameraWorldMatrix[14],
          0,
        ]);
        this.device.queue.writeBuffer(
          resources.uniformBuffer,
          240,
          cameraPosData as Float32Array<ArrayBuffer>
        );
      } else if (material instanceof ShaderMaterial) {
        // Call custom uniform writer if provided
        if (material.writeUniformData) {
          const uniformData = new ArrayBuffer(material.getUniformBufferSize());
          const dataView = new DataView(uniformData);

          // Call the user-provided callback to write custom uniform data to the local buffer
          material.writeUniformData(dataView, 0);

          // Write the custom uniform data to GPU (starting at offset 64, after MVP)
          const customDataSize = material.getUniformBufferSize() - 64;
          if (customDataSize > 0) {
            this.device.queue.writeBuffer(
              resources.uniformBuffer,
              64,
              uniformData,
              64, // source offset
              customDataSize // size to copy
            );
          }
        }
      }

      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, resources.bindGroup);
      passEncoder.setVertexBuffer(0, resources.vertexBuffer);

      // Use draw() for non-indexed geometry (e.g., lines), drawIndexed() otherwise
      if (mesh.indexCount > 0) {
        passEncoder.setIndexBuffer(resources.indexBuffer, "uint16");
        passEncoder.drawIndexed(mesh.indexCount);
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
