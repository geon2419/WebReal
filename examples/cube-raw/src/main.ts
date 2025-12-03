import { Engine } from "@web-real-3d/core";
import { Matrix4, Vector3 } from "@web-real-3d/math";
import GUI from "lil-gui";

import cubeVertShader from "./shaders/cube.vert.wgsl?raw";
import cubeFragShader from "./shaders/cube.frag.wgsl?raw";

function createCubeVertices(): {
  vertices: Float32Array<ArrayBuffer>;
  indices: Uint16Array<ArrayBuffer>;
} {
  // 24 vertices: 6 faces × 4 vertices
  const positions = [
    // Front face
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
    // Back face
    [1, -1, -1],
    [-1, -1, -1],
    [-1, 1, -1],
    [1, 1, -1],
    // Top face
    [-1, 1, 1],
    [1, 1, 1],
    [1, 1, -1],
    [-1, 1, -1],
    // Bottom face
    [-1, -1, -1],
    [1, -1, -1],
    [1, -1, 1],
    [-1, -1, 1],
    // Right face
    [1, -1, 1],
    [1, -1, -1],
    [1, 1, -1],
    [1, 1, 1],
    // Left face
    [-1, -1, -1],
    [-1, -1, 1],
    [-1, 1, 1],
    [-1, 1, -1],
  ];

  const colors = [
    // Front face - Red
    [1.0, 0.3, 0.3],
    [1.0, 0.3, 0.3],
    [1.0, 0.3, 0.3],
    [1.0, 0.3, 0.3],
    // Back face - Green
    [0.3, 1.0, 0.3],
    [0.3, 1.0, 0.3],
    [0.3, 1.0, 0.3],
    [0.3, 1.0, 0.3],
    // Top face - Blue
    [0.3, 0.3, 1.0],
    [0.3, 0.3, 1.0],
    [0.3, 0.3, 1.0],
    [0.3, 0.3, 1.0],
    // Bottom face - Yellow
    [1.0, 1.0, 0.3],
    [1.0, 1.0, 0.3],
    [1.0, 1.0, 0.3],
    [1.0, 1.0, 0.3],
    // Right face - Magenta
    [1.0, 0.3, 1.0],
    [1.0, 0.3, 1.0],
    [1.0, 0.3, 1.0],
    [1.0, 0.3, 1.0],
    // Left face - Cyan
    [0.3, 1.0, 1.0],
    [0.3, 1.0, 1.0],
    [0.3, 1.0, 1.0],
    [0.3, 1.0, 1.0],
  ];

  // Interleaved vertex data: position(vec3) + color(vec3) = 6 floats per vertex
  const vertexData: number[] = [];
  for (let i = 0; i < 24; i++) {
    vertexData.push(...positions[i], ...colors[i]);
  }

  // Indices for 12 triangles (6 faces × 2 triangles)
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14,
    15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);

  return {
    vertices: new Float32Array(vertexData) as Float32Array<ArrayBuffer>,
    indices: indices as Uint16Array<ArrayBuffer>,
  };
}

// GUI 파라미터 인터페이스
interface CubeParams {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  autoRotate: boolean;
  rotationSpeed: number;
  scale: number;
  cameraDistance: number;
  fov: number;
}

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  try {
    const engine = await Engine.create({ canvas });
    const device = engine.device;

    const params: CubeParams = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      autoRotate: true,
      rotationSpeed: 1.0,
      scale: 1.0,
      cameraDistance: 5.0,
      fov: 60,
    };

    const gui = new GUI({ title: "Cube Controls" });

    const rotationFolder = gui.addFolder("Rotation");
    rotationFolder
      .add(params, "rotationX", -Math.PI, Math.PI)
      .name("X Rotation");
    rotationFolder
      .add(params, "rotationY", -Math.PI, Math.PI)
      .name("Y Rotation");
    rotationFolder
      .add(params, "rotationZ", -Math.PI, Math.PI)
      .name("Z Rotation");
    rotationFolder.add(params, "autoRotate").name("Auto Rotate");
    rotationFolder.add(params, "rotationSpeed", 0, 3).name("Rotation Speed");

    const transformFolder = gui.addFolder("Transform");
    transformFolder.add(params, "scale", 0.1, 3).name("Scale");

    const cameraFolder = gui.addFolder("Camera");
    cameraFolder.add(params, "cameraDistance", 2, 15).name("Distance");
    cameraFolder.add(params, "fov", 30, 120).name("FOV");

    const vertexShaderModule = device.createShaderModule({
      label: "Cube Vertex Shader",
      code: cubeVertShader,
    });

    const fragmentShaderModule = device.createShaderModule({
      label: "Cube Fragment Shader",
      code: cubeFragShader,
    });

    let depthTexture = device.createTexture({
      label: "Depth Texture",
      size: [canvas.width, canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const resizeObserver = new ResizeObserver(() => {
      depthTexture.destroy();
      depthTexture = device.createTexture({
        label: "Depth Texture",
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    });
    resizeObserver.observe(canvas);

    const pipeline = device.createRenderPipeline({
      label: "Cube Pipeline",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "main",
        targets: [{ format: engine.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
        frontFace: "ccw",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    const { vertices, indices } = createCubeVertices();

    const vertexBuffer = device.createBuffer({
      label: "Cube Vertex Buffer",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const indexBuffer = device.createBuffer({
      label: "Cube Index Buffer",
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indices);

    const uniformBuffer = device.createBuffer({
      label: "Uniform Buffer",
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
      label: "Cube Bind Group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    let accumulatedRotation = 0;

    engine.run((deltaTime: number) => {
      if (params.autoRotate) {
        accumulatedRotation += deltaTime * params.rotationSpeed;
      }

      const aspect = canvas.width / canvas.height;
      const fovRad = (params.fov * Math.PI) / 180;

      // Projection Matrix
      const projection = Matrix4.perspective(fovRad, aspect, 0.1, 100);

      // View Matrix
      const eye = new Vector3(0, 2, params.cameraDistance);
      const target = new Vector3(0, 0, 0);
      const up = new Vector3(0, 1, 0);
      const view = Matrix4.lookAt(eye, target, up);

      // Model Matrix
      const rotX = Matrix4.rotationX(
        params.rotationX + (params.autoRotate ? accumulatedRotation * 0.5 : 0)
      );
      const rotY = Matrix4.rotationY(
        params.rotationY + (params.autoRotate ? accumulatedRotation : 0)
      );
      const rotZ = Matrix4.rotationZ(params.rotationZ);
      const scale = Matrix4.scaling(
        new Vector3(params.scale, params.scale, params.scale)
      );
      const model = rotZ.multiply(rotY).multiply(rotX).multiply(scale);

      // MVP Matrix
      const mvp = projection.multiply(view).multiply(model);

      device.queue.writeBuffer(
        uniformBuffer,
        0,
        mvp.data as Float32Array<ArrayBuffer>
      );

      const commandEncoder = device.createCommandEncoder();
      const textureView = engine.context.getCurrentTexture().createView();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.setIndexBuffer(indexBuffer, "uint16");
      renderPass.drawIndexed(indices.length);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
    });

    window.addEventListener("beforeunload", () => {
      resizeObserver.disconnect();
      gui.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      uniformBuffer.destroy();
      depthTexture.destroy();
      engine.dispose();
    });
  } catch (error) {
    console.error(error);
  }
}

main();
