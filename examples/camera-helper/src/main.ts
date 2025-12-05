import {
  Engine,
  Renderer,
  BoxGeometry,
  VertexColorMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
  CameraFrustumHelper,
  OrbitCameraController,
} from "@web-real/core";
import { Color } from "@web-real/math";
import GUI from "lil-gui";

interface Params {
  // Cube params
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  autoRotate: boolean;
  rotationSpeed: number;
  scale: number;
  // Observer camera params
  observerX: number;
  observerY: number;
  observerZ: number;
  observerFov: number;
  // Main camera params
  mainFov: number;
  mainNear: number;
  mainFar: number;
  mainDistance: number;
  showFrustum: boolean;
}

function createGUI(params: Params): GUI {
  const gui = new GUI({ title: "Camera Helper Demo" });

  const cubeFolder = gui.addFolder("Cube");
  cubeFolder.add(params, "autoRotate").name("Auto Rotate");
  cubeFolder.add(params, "rotationSpeed", 0, 3).name("Rotation Speed");
  cubeFolder.add(params, "scale", 0.1, 3).name("Scale");

  const observerFolder = gui.addFolder("Observer Camera (Left)");
  observerFolder.add(params, "observerX", -15, 15).name("Position X");
  observerFolder.add(params, "observerY", -15, 15).name("Position Y");
  observerFolder.add(params, "observerZ", -15, 15).name("Position Z");
  observerFolder.add(params, "observerFov", 30, 120).name("FOV");

  const mainFolder = gui.addFolder("Main Camera (Right)");
  mainFolder.add(params, "showFrustum").name("Show Frustum");
  mainFolder.add(params, "mainDistance", 2, 8).name("Distance");
  mainFolder.add(params, "mainFov", 30, 120).name("FOV");
  mainFolder.add(params, "mainNear", 0.1, 2).name("Near Plane");
  mainFolder.add(params, "mainFar", 2, 10).name("Far Plane");

  return gui;
}

async function main() {
  const canvasObserver = document.getElementById(
    "canvas-observer"
  ) as HTMLCanvasElement;
  const canvasMain = document.getElementById(
    "canvas-main"
  ) as HTMLCanvasElement;

  try {
    const engineObserver = await Engine.create({ canvas: canvasObserver });
    const rendererObserver = new Renderer(engineObserver);
    rendererObserver.setClearColor([0.1, 0.1, 0.1]);

    const engineMain = await Engine.create({ canvas: canvasMain });
    const rendererMain = new Renderer(engineMain);
    rendererMain.setClearColor([0.15, 0.1, 0.1]);

    const params: Params = {
      // Cube params
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      autoRotate: true,
      rotationSpeed: 1.0,
      scale: 1.0,
      // Observer camera params
      observerX: 8.0,
      observerY: 3.0,
      observerZ: 8.0,
      observerFov: 60,
      // Main camera params
      mainFov: 60,
      mainNear: 0.5,
      mainFar: 5,
      mainDistance: 4,
      showFrustum: true,
    };

    const gui = createGUI(params);

    // Face colors using Color class
    const faceColors = [
      Color.fromHex("#ff4d4d"), // Front - Red
      Color.fromHex("#4dff4d"), // Back - Green
      Color.fromHex("#4d4dff"), // Top - Blue
      Color.fromHex("#ffff4d"), // Bottom - Yellow
      Color.fromHex("#ff4dff"), // Right - Magenta
      Color.fromHex("#4dffff"), // Left - Cyan
    ];

    const sceneObserver = new Scene();
    const cubeGeometry = new BoxGeometry(2, 2, 2);
    const cubeMaterial = new VertexColorMaterial({ faceColors });
    const observerCubeMesh = new Mesh(cubeGeometry, cubeMaterial);
    sceneObserver.add(observerCubeMesh);

    const sceneMain = new Scene();
    const mainCubeMesh = new Mesh(cubeGeometry, cubeMaterial);
    sceneMain.add(mainCubeMesh);

    const mainCamera = new PerspectiveCamera({
      fov: params.mainFov,
      aspect: canvasMain.width / canvasMain.height,
      near: params.mainNear,
      far: params.mainFar,
    });

    // Control Main camera with OrbitCameraController
    const mainOrbitController = new OrbitCameraController(
      mainCamera,
      canvasMain,
      {
        radius: params.mainDistance,
        theta: 0,
        phi: Math.PI / 2, // Start from the front
      }
    );

    const cameraFrustumHelper = new CameraFrustumHelper(mainCamera, {
      nearColor: Color.GREEN,
      farColor: Color.RED,
      sideColor: Color.YELLOW,
      coneColor: Color.fromHex("#8080ff"), // Light blue
    });
    sceneObserver.add(cameraFrustumHelper);

    const observerCamera = new PerspectiveCamera({
      fov: params.observerFov,
      aspect: canvasObserver.width / canvasObserver.height,
      near: 0.1,
      far: 100,
    });

    // Use OrbitCameraController to control the Observer camera
    const orbitController = new OrbitCameraController(
      observerCamera,
      canvasObserver,
      {
        radius: Math.sqrt(
          params.observerX ** 2 + params.observerY ** 2 + params.observerZ ** 2
        ),
        theta: Math.atan2(params.observerX, params.observerZ),
        phi: Math.acos(
          params.observerY /
            Math.sqrt(
              params.observerX ** 2 +
                params.observerY ** 2 +
                params.observerZ ** 2
            )
        ),
      }
    );

    // Use the first engine's run loop for timing
    engineObserver.run((deltaTime: number) => {
      // Update cube rotation
      if (params.autoRotate) {
        params.rotationX += deltaTime * params.rotationSpeed * 0.5;
        params.rotationY += deltaTime * params.rotationSpeed;
      }

      // Sync both cube meshes
      observerCubeMesh.rotation.set(
        params.rotationX,
        params.rotationY,
        params.rotationZ
      );
      observerCubeMesh.scale.set(params.scale, params.scale, params.scale);

      mainCubeMesh.rotation.set(
        params.rotationX,
        params.rotationY,
        params.rotationZ
      );
      mainCubeMesh.scale.set(params.scale, params.scale, params.scale);

      // Update observer camera (OrbitController manages position and lookAt)
      observerCamera.fov = params.observerFov;

      // Update main camera (OrbitController manages position and lookAt)
      mainCamera.fov = params.mainFov;
      mainCamera.near = params.mainNear;
      mainCamera.far = params.mainFar;

      // Update frustum helper
      cameraFrustumHelper.update();
      cameraFrustumHelper.visible = params.showFrustum;

      // Render both views
      rendererObserver.render(sceneObserver, observerCamera);
      rendererMain.render(sceneMain, mainCamera);
    });

    window.addEventListener("beforeunload", () => {
      orbitController.dispose();
      mainOrbitController.dispose();
      observerCamera.dispose();
      mainCamera.dispose();
      gui.destroy();
      rendererObserver.dispose();
      rendererMain.dispose();
      engineObserver.dispose();
      engineMain.dispose();
    });
  } catch (error) {
    console.error(error);
  }
}

main();
