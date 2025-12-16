import type { Camera } from "../camera/Camera";
import type { Light } from "../light/Light";
import type { RenderContext } from "../material/Material";
import type { Mesh } from "../scene/Mesh";
import { InstancedMesh } from "../scene/InstancedMesh";
import type { Scene } from "../scene/Scene";
import { MeshResourceCache } from "./MeshResourceCache";
import { PipelineCache } from "./PipelineCache";

/**
 * Renders scene meshes into a render pass using cached pipelines and GPU resources.
 *
 * @example
 * ```ts
 * const meshPass = new MeshPass({ device, pipelines, meshResources });
 * meshPass.render({ passEncoder, meshes, lights, scene, camera });
 * ```
 */
export class MeshPass {
  private _device: GPUDevice;
  private _pipelines: PipelineCache;
  private _meshResources: MeshResourceCache;

  /**
   * Creates a new MeshPass.
   * @param options - Construction options
   * @param options.device - The WebGPU device used for buffer updates
   * @param options.pipelines - Pipeline cache used to get or create material pipelines
   * @param options.meshResources - Mesh resource cache used to get or create GPU buffers/bind groups
   */
  constructor(options: {
    device: GPUDevice;
    pipelines: PipelineCache;
    meshResources: MeshResourceCache;
  }) {
    this._device = options.device;
    this._pipelines = options.pipelines;
    this._meshResources = options.meshResources;
  }

  /**
   * Draws the provided meshes using their materials, camera matrices, and scene lights.
   * @param options - Render options
   * @param options.passEncoder - Active render pass encoder to record draw commands into
   * @param options.meshes - Meshes to render
   * @param options.lights - Lights to include in the material render context
   * @param options.scene - Scene used for material render context
   * @param options.camera - Camera providing view/projection matrices
   */
  render(options: {
    passEncoder: GPURenderPassEncoder;
    meshes: Mesh[];
    lights: Light[];
    scene: Scene;
    camera: Camera;
  }): void {
    for (const mesh of options.meshes) {
      const material = mesh.material;
      const pipeline = this._pipelines.getOrCreate(material);
      const resources = this._meshResources.getOrCreate(mesh, pipeline);

      const mvpMatrix = options.camera.projectionMatrix
        .multiply(options.camera.viewMatrix)
        .multiply(mesh.worldMatrix);

      this._device.queue.writeBuffer(
        resources.uniformBuffer,
        0,
        mvpMatrix.data as Float32Array<ArrayBuffer>
      );

      if (material.writeUniformData) {
        const renderContext: RenderContext = {
          camera: options.camera,
          scene: options.scene,
          mesh,
          lights: options.lights,
        };

        const uniformData =
          "getUniformDataBuffer" in material &&
          typeof (material as any).getUniformDataBuffer === "function"
            ? ((material as any).getUniformDataBuffer() as ArrayBuffer)
            : new ArrayBuffer(material.getUniformBufferSize());

        const dataView = new DataView(uniformData);

        const uniformDataOffset = material.getUniformDataOffset?.() ?? 64;
        if (uniformDataOffset < 64) {
          throw new Error(
            `Material.getUniformDataOffset() must be >= 64 (got ${uniformDataOffset})`
          );
        }

        material.writeUniformData(dataView, uniformDataOffset, renderContext);

        const customDataSize =
          material.getUniformBufferSize() - uniformDataOffset;
        if (customDataSize > 0) {
          this._device.queue.writeBuffer(
            resources.uniformBuffer,
            uniformDataOffset,
            uniformData,
            uniformDataOffset,
            customDataSize
          );
        }
      }

      if (mesh instanceof InstancedMesh) {
        mesh.updateStorageBuffer(this._device);
      }

      options.passEncoder.setPipeline(pipeline);
      options.passEncoder.setBindGroup(0, resources.bindGroup);

      if (resources.iblBindGroup) {
        options.passEncoder.setBindGroup(1, resources.iblBindGroup);
      }

      if (resources.instanceBindGroup) {
        options.passEncoder.setBindGroup(2, resources.instanceBindGroup);
      }

      options.passEncoder.setVertexBuffer(0, resources.vertexBuffer);

      // Use instance count from resources (defaults to 1 for non-instanced materials)
      const instanceCount = resources.instanceCount;

      if (resources.indexCount > 0) {
        options.passEncoder.setIndexBuffer(
          resources.indexBuffer,
          resources.indexFormat
        );
        options.passEncoder.drawIndexed(resources.indexCount, instanceCount);
      } else {
        options.passEncoder.draw(mesh.vertexCount, instanceCount);
      }
    }
  }
}
