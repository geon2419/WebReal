import {
  Engine,
  Renderer,
  PlaneGeometry,
  BoxGeometry,
  TextureMaterial,
  Texture,
  Mesh,
  Scene,
  PerspectiveCamera,
  OrbitCameraController,
} from "@web-real/core";
import { Vector3 } from "@web-real/math";

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  function updateCanvasSize() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    const width = Math.floor(displayWidth * dpr);
    const height = Math.floor(displayHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  updateCanvasSize();

  try {
    const engine = await Engine.create({ canvas });
    const renderer = new Renderer(engine);
    renderer.setClearColor([0.15, 0.15, 0.2]);

    const scene = new Scene();

    const camera = new PerspectiveCamera({
      fov: 60,
      aspect: canvas.width / canvas.height,
      near: 0.1,
      far: 100,
    });
    camera.position.set(0, 2, 5);
    camera.lookAt(new Vector3(0, 0, 0));

    const controller = new OrbitCameraController(camera, canvas);

    // Create a simple procedural texture (checkerboard pattern)
    const textureSize = 256;
    const checkerSize = 32;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = textureSize;
    textureCanvas.height = textureSize;
    const ctx = textureCanvas.getContext("2d")!;

    for (let y = 0; y < textureSize; y += checkerSize) {
      for (let x = 0; x < textureSize; x += checkerSize) {
        const isEven = (x / checkerSize + y / checkerSize) % 2 === 0;
        ctx.fillStyle = isEven ? "#ffffff" : "#4a90e2";
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // Convert canvas to blob and create texture
    const blob = await new Promise<Blob>((resolve) =>
      textureCanvas.toBlob((b) => resolve(b!))
    );
    const imageBitmap = await createImageBitmap(blob);

    // Create GPU texture manually
    const gpuTexture = engine.device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    engine.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: gpuTexture },
      [imageBitmap.width, imageBitmap.height]
    );

    const sampler = engine.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

    const texture = new Texture(
      gpuTexture,
      sampler,
      imageBitmap.width,
      imageBitmap.height
    );

    // Create textured plane
    const planeGeometry = new PlaneGeometry({
      width: 3,
      height: 3,
      orientation: "XZ",
      widthSegments: 1,
      heightSegments: 1,
    });
    const planeMaterial = new TextureMaterial({ texture });
    const plane = new Mesh(planeGeometry, planeMaterial);
    plane.position.y = -1;
    scene.add(plane);

    // Create textured cube
    const boxGeometry = new BoxGeometry(1.5, 1.5, 1.5);
    const boxMaterial = new TextureMaterial({ texture });
    const box = new Mesh(boxGeometry, boxMaterial);
    box.position.set(0, 0.75, 0);
    scene.add(box);

    let lastTime = 0;
    function render(time: number) {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      // Rotate the cube
      box.rotation.y += deltaTime * 0.5;
      box.rotation.x += deltaTime * 0.3;

      controller.update();

      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    window.addEventListener("resize", () => {
      updateCanvasSize();
      camera.aspect = canvas.width / canvas.height;
    });
  } catch (error) {
    console.error("Failed to initialize WebGPU:", error);
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText =
      "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ff4444; color: white; padding: 20px; border-radius: 8px; font-family: monospace;";
    errorDiv.textContent = `WebGPU Error: ${error}`;
    document.body.appendChild(errorDiv);
  }
}

main();
