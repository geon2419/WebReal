import { Engine } from '@web-real-3d/core';

import triangleVertShader from './shaders/triangle.vert.wgsl?raw';
import triangleFragShader from './shaders/triangle.frag.wgsl?raw';

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;

  try {
    const engine = await Engine.create({ canvas });
    const device = engine.device;

    const vertexShaderModule = device.createShaderModule({
      label: 'Triangle Vertex Shader',
      code: triangleVertShader,
    });

    const fragmentShaderModule = device.createShaderModule({
      label: 'Triangle Fragment Shader',
      code: triangleFragShader,
    });

    const pipeline = device.createRenderPipeline({
      label: 'Triangle Pipeline',
      layout: 'auto',
      vertex: {
        module: vertexShaderModule,
        entryPoint: 'main',
        buffers: [
          {
            // NOTE: position(vec2) + color(vec3) = 5 floats * 4 bytes
            arrayStride: 20,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x3' },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: 'main',
        targets: [{ format: engine.format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    const vertices = new Float32Array([
       0.0,  0.5, 1.0, 0.0, 0.0,
      -0.5, -0.5, 0.0, 1.0, 0.0,
       0.5, -0.5, 0.0, 0.0, 1.0,
    ]);

    const vertexBuffer = device.createBuffer({
      label: 'Triangle Vertex Buffer',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    engine.run(() => {
      const commandEncoder = device.createCommandEncoder();
      const textureView = engine.context.getCurrentTexture().createView();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      renderPass.setPipeline(pipeline);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.draw(3);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
    });

    window.addEventListener('beforeunload', () => {
      vertexBuffer.destroy();
      engine.dispose();
    });
  } catch (error) {
    console.error(error);
  }
}

main();
