import {
  Engine,
  BoxGeometry,
  VertexColorMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
} from "@web-real-3d/core";
import { Vector3 } from "@web-real-3d/math";
import GUI from "lil-gui";

type FaceColors = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

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

    const faceColors: FaceColors = [
      [1.0, 0.3, 0.3], // Front - Red
      [0.3, 1.0, 0.3], // Back - Green
      [0.3, 0.3, 1.0], // Top - Blue
      [1.0, 1.0, 0.3], // Bottom - Yellow
      [1.0, 0.3, 1.0], // Right - Magenta
      [0.3, 1.0, 1.0], // Left - Cyan
    ];
    const scene = new Scene();
    const geometry = new BoxGeometry(2, 2, 2);
    const material = new VertexColorMaterial({ faceColors });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    const camera = new PerspectiveCamera({
      fov: params.fov,
      near: 0.1,
      far: 100,
    });
    camera.position.set(0, 2, params.cameraDistance);
    camera.lookAt(new Vector3(0, 0, 0));
    camera.updateAspect(canvas);

    const vertexShaderModule = device.createShaderModule({
      label: "Cube Vertex Shader",
      code: material.getVertexShader(),
    });

    const fragmentShaderModule = device.createShaderModule({
      label: "Cube Fragment Shader",
      code: material.getFragmentShader(),
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
        buffers: [material.getVertexBufferLayout()],
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

    const vertices = mesh.getInterleavedVertices();
    const indices = mesh.indices;

    const vertexBuffer = device.createBuffer({
      label: "Cube Vertex Buffer",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      vertexBuffer,
      0,
      vertices as Float32Array<ArrayBuffer>
    );

    const indexBuffer = device.createBuffer({
      label: "Cube Index Buffer",
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      indexBuffer,
      0,
      indices as Uint16Array<ArrayBuffer>
    );

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

    engine.run((deltaTime: number) => {
      // Update mesh transform from params
      if (params.autoRotate) {
        params.rotationX += deltaTime * params.rotationSpeed * 0.5;
        params.rotationY += deltaTime * params.rotationSpeed;
      }

      mesh.rotation.set(params.rotationX, params.rotationY, params.rotationZ);
      mesh.scale.set(params.scale, params.scale, params.scale);

      // Update camera from params
      camera.fov = params.fov;
      camera.position.set(0, 2, params.cameraDistance);

      // Update scene graph world matrices
      scene.updateMatrixWorld();

      // MVP Matrix using camera
      const mvp = camera.projectionMatrix
        .multiply(camera.viewMatrix)
        .multiply(mesh.worldMatrix);

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
      renderPass.drawIndexed(mesh.indexCount);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
    });

    window.addEventListener("beforeunload", () => {
      resizeObserver.disconnect();
      camera.dispose();
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
