import { InstancedMesh, ShaderMaterial, SphereGeometry } from "@web-real/core";

import { NodeDataLoader, type NodeData } from "./NodeDataLoader";

import instancedVertexShader from "./shaders/instancedVertex.wgsl?raw";
import instancedFragmentShader from "./shaders/instancedFragment.wgsl?raw";

export interface CreateNodeMeshOptions {
  instanceSize: number;
  getInstanceScale: () => number;
}

export class NodeMeshFactory {
  static createNodeMesh(
    nodes: NodeData[],
    options: CreateNodeMeshOptions
  ): InstancedMesh {
    const geometry = new SphereGeometry({
      radius: 1,
      widthSegments: 6,
      heightSegments: 4,
    });

    const material = new ShaderMaterial({
      vertexShader: instancedVertexShader,
      fragmentShader: instancedFragmentShader,
      // MVP(64) + instanceScale(vec4=16)
      uniformBufferSize: 80,
      writeUniformData: (buffer, offset = 64) => {
        buffer.setFloat32(offset + 0, options.getInstanceScale(), true);
        buffer.setFloat32(offset + 4, 0, true);
        buffer.setFloat32(offset + 8, 0, true);
        buffer.setFloat32(offset + 12, 0, true);
      },
    });

    return new InstancedMesh(geometry, material, nodes.length, {
      mode: "position",
      instanceSize: options.instanceSize,
    });
  }

  static applyNodesToMesh(mesh: InstancedMesh, nodes: NodeData[]): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      mesh.setPositionAt(i, node.x, node.y, node.z);

      const color = NodeDataLoader.getNodeColor(node.class);
      mesh.setColorAt(i, color[0], color[1], color[2], 1);
    }
  }
}
