import { getIndexFormat } from "../geometry/Geometry";
import type { Mesh } from "../scene/Mesh";
import { FallbackResources } from "./FallbackResources";

/**
 * GPU resources created for a mesh, including buffers and bind groups.
 */
export interface MeshGPUResources {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  iblBindGroup?: GPUBindGroup;
  materialType: string;
  topology: GPUPrimitiveTopology;
  bindingRevision: number;
  indexCount: number;
  indexFormat: GPUIndexFormat;
}

/**
 * Caches per-mesh GPU buffers and bind groups, recreating them when mesh/material changes.
 *
 * @example
 * ```ts
 * const meshResources = new MeshResourceCache({ device, fallback });
 * const resources = meshResources.getOrCreate(mesh, pipeline);
 * // passEncoder.setBindGroup(0, resources.bindGroup);
 * ```
 */
export class MeshResourceCache {
  private _device: GPUDevice;
  private _fallback: FallbackResources;

  private _meshBuffers: WeakMap<Mesh, MeshGPUResources> = new WeakMap();
  private _trackedMeshResources: Set<MeshGPUResources> = new Set();

  /**
   * Creates a new MeshResourceCache.
   * @param options - Construction options
   * @param options.device - The WebGPU device used to create buffers and bind groups
   * @param options.fallback - Fallback textures/samplers used when optional resources are missing
   */
  constructor(options: { device: GPUDevice; fallback: FallbackResources }) {
    this._device = options.device;
    this._fallback = options.fallback;
  }

  /**
   * Returns cached GPU resources for the mesh, creating or updating them as needed.
   * @param mesh - Mesh providing geometry, indices, and material bindings
   * @param pipeline - Pipeline used to query bind group layouts
   * @returns Cached or newly created GPU resources for the mesh
   */
  getOrCreate(mesh: Mesh, pipeline: GPURenderPipeline): MeshGPUResources {
    let resources = this._meshBuffers.get(mesh);
    const currentMaterialType = mesh.material.type;
    const currentTopology = mesh.material.getPrimitiveTopology();
    const currentBindingRevision = mesh.material.bindingRevision ?? 0;

    if (
      resources &&
      (resources.materialType !== currentMaterialType ||
        resources.topology !== currentTopology ||
        mesh.needsUpdate)
    ) {
      this._destroyMeshResources(resources);
      resources = undefined;
      mesh.needsUpdate = false;
    }

    if (resources && resources.bindingRevision !== currentBindingRevision) {
      const uniformBuffer = resources.uniformBuffer;
      const bindGroupEntries = this._createMeshBindGroupEntries(
        mesh,
        uniformBuffer
      );

      resources.bindGroup = this._device.createBindGroup({
        label: "Mesh Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: bindGroupEntries,
      });

      if (
        mesh.material.getIBLTextures &&
        typeof mesh.material.getIBLTextures === "function"
      ) {
        resources.iblBindGroup = this._createIBLBindGroup(mesh, pipeline);
      }

      resources.bindingRevision = currentBindingRevision;
    }

    if (!resources) {
      const vertexData = mesh.getInterleavedVertices();
      const vertexBuffer = this._device.createBuffer({
        label: "Mesh Vertex Buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
      this._device.queue.writeBuffer(
        vertexBuffer,
        0,
        vertexData as Float32Array<ArrayBuffer>
      );

      const indexData =
        currentTopology === "line-list"
          ? mesh.getWireframeIndices()
          : mesh.indices;
      const indexFormat = getIndexFormat(indexData);
      const indexBuffer = this._device.createBuffer({
        label: "Mesh Index Buffer",
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
      this._device.queue.writeBuffer(
        indexBuffer,
        0,
        indexData instanceof Uint32Array
          ? (indexData as Uint32Array<ArrayBuffer>)
          : (indexData as Uint16Array<ArrayBuffer>)
      );

      const uniformBufferSize = mesh.material.getUniformBufferSize();
      const uniformBuffer = this._device.createBuffer({
        label: "Mesh Uniform Buffer",
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroupEntries = this._createMeshBindGroupEntries(
        mesh,
        uniformBuffer
      );

      const bindGroup = this._device.createBindGroup({
        label: "Mesh Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: bindGroupEntries,
      });

      // Check if material supports IBL via interface method
      let iblBindGroup: GPUBindGroup | undefined;
      if (
        mesh.material.getIBLTextures &&
        typeof mesh.material.getIBLTextures === "function"
      ) {
        iblBindGroup = this._createIBLBindGroup(mesh, pipeline);
      }

      resources = {
        vertexBuffer,
        indexBuffer,
        uniformBuffer,
        bindGroup,
        iblBindGroup,
        materialType: currentMaterialType,
        topology: currentTopology,
        bindingRevision: currentBindingRevision,
        indexCount: indexData.length,
        indexFormat,
      };

      this._meshBuffers.set(mesh, resources);
      this._trackedMeshResources.add(resources);
    }

    return resources;
  }

  /**
   * Disposes GPU resources associated with a specific mesh.
   * @param mesh - Mesh whose cached resources should be destroyed
   */
  disposeMesh(mesh: Mesh): void {
    const resources = this._meshBuffers.get(mesh);
    if (!resources) return;

    this._destroyMeshResources(resources);
    this._meshBuffers.delete(mesh);
  }

  /**
   * Disposes all tracked mesh GPU resources.
   */
  disposeAll(): void {
    for (const resources of this._trackedMeshResources) {
      resources.vertexBuffer.destroy();
      resources.indexBuffer.destroy();
      resources.uniformBuffer.destroy();
    }

    this._trackedMeshResources.clear();
    this._meshBuffers = new WeakMap();
  }

  private _destroyMeshResources(resources: MeshGPUResources): void {
    resources.vertexBuffer.destroy();
    resources.indexBuffer.destroy();
    resources.uniformBuffer.destroy();
    this._trackedMeshResources.delete(resources);
  }

  /**
   * Creates bind group entries for a mesh, including uniform buffer and texture bindings.
   * @param mesh - Mesh providing material and texture information
   * @param uniformBuffer - GPU buffer containing uniform data
   * @returns Array of bind group entries ready for bind group creation
   */
  private _createMeshBindGroupEntries(
    mesh: Mesh,
    uniformBuffer: GPUBuffer
  ): GPUBindGroupEntry[] {
    const entries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ];

    if (mesh.material.getTextures) {
      const textures = mesh.material.getTextures(this._device);
      if (textures.length > 0) {
        entries.push({
          binding: 1,
          resource: textures[0].gpuSampler,
        });
        textures.forEach((texture, index) => {
          entries.push({
            binding: 2 + index,
            resource: texture.gpuTexture.createView(),
          });
        });
      }
    }

    return entries;
  }

  /**
   * Creates an IBL bind group for materials that support image-based lighting.
   * @param mesh - Mesh with material that implements getIBLTextures
   * @param pipeline - Pipeline used to query bind group layout
   * @returns IBL bind group with prefilteredMap, irradianceMap, and brdfLUT
   */
  private _createIBLBindGroup(
    mesh: Mesh,
    pipeline: GPURenderPipeline
  ): GPUBindGroup {
    const iblTextures = mesh.material.getIBLTextures?.(this._device);

    if (iblTextures) {
      return this._device.createBindGroup({
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
      // Create dummy IBL bind group
      const dummyCube = this._fallback.getDummyCubeTexture();
      const dummyBrdf = this._fallback.getDummyBrdfLUT();
      const dummySampler = this._fallback.getLinearSampler();

      return this._device.createBindGroup({
        label: "Dummy IBL Bind Group",
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          { binding: 0, resource: dummySampler },
          {
            binding: 1,
            resource: dummyCube.createView({ dimension: "cube" }),
          },
          {
            binding: 2,
            resource: dummyCube.createView({ dimension: "cube" }),
          },
          { binding: 3, resource: dummyBrdf.createView() },
        ],
      });
    }
  }
}
