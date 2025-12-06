import {
  Engine,
  Renderer,
  BoxGeometry,
  Mesh,
  Scene,
  OrthographicCamera,
  OrthographicCameraHelper,
  PerspectiveCamera,
  VertexColorMaterial,
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
  positionX: number;
  positionY: number;
  positionZ: number;
  // Observer camera params
  observerX: number;
  observerY: number;
  observerZ: number;
  observerFov: number;
  // Main camera params (orthographic)
  mainLeft: number;
  mainRight: number;
  mainTop: number;
  mainBottom: number;
  mainNear: number;
  mainFar: number;
  showFrustum: boolean;
}

function createGUI(params: Params): GUI {
  const gui = new GUI({ title: "Orthographic Camera Demo" });

  const cubeFolder = gui.addFolder("Cube");
  cubeFolder.add(params, "autoRotate").name("Auto Rotate");
  cubeFolder.add(params, "rotationSpeed", 0, 3).name("Rotation Speed");
  cubeFolder.add(params, "scale", 0.1, 3).name("Scale");
  cubeFolder.add(params, "positionX", -10, 10).name("Position X");
  cubeFolder.add(params, "positionY", -10, 10).name("Position Y");
  cubeFolder.add(params, "positionZ", -10, 10).name("Position Z");

  const observerFolder = gui.addFolder("Observer Camera (Left)");
  observerFolder.add(params, "observerFov", 30, 120).name("FOV");

  const mainFolder = gui.addFolder("Main Camera (Right - Orthographic)");
  mainFolder.add(params, "showFrustum").name("Show Frustum");
  mainFolder.add(params, "mainLeft", -10, 0).name("Left");
  mainFolder.add(params, "mainRight", 0, 10).name("Right");
  mainFolder.add(params, "mainTop", 0, 10).name("Top");
  mainFolder.add(params, "mainBottom", -10, 0).name("Bottom");
  mainFolder.add(params, "mainNear", 10, 20).name("Near Plane");
  mainFolder.add(params, "mainFar", 10, 100).name("Far Plane");

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
      positionX: 0,
      positionY: 0,
      positionZ: 20,
      // Observer camera params
      observerX: 12.0,
      observerY: 8.0,
      observerZ: 12.0,
      observerFov: 60,
      // Main camera params (orthographic)
      mainLeft: -5,
      mainRight: 5,
      mainTop: 5,
      mainBottom: -5,
      mainNear: 10,
      mainFar: 30,
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

    const mainCamera = new OrthographicCamera({
      left: params.mainLeft,
      right: params.mainRight,
      top: params.mainTop,
      bottom: params.mainBottom,
      near: params.mainNear,
      far: params.mainFar,
    });

    const mainOrbitController = new OrbitCameraController(
      mainCamera,
      canvasMain,
      {
        radius: 0,
        theta: 0,
        phi: Math.PI / 2,
        zoomSpeed: 0.5,
      }
    );

    // Create frustum helper AFTER orbit controller so camera is in correct position
    const orthographicCameraHelper = new OrthographicCameraHelper(mainCamera, {
      nearColor: Color.GREEN,
      farColor: Color.RED,
      sideColor: Color.YELLOW,
      coneColor: Color.fromHex("#8080ff"),
    });
    sceneObserver.add(orthographicCameraHelper);

    const observerCamera = new PerspectiveCamera({
      fov: params.observerFov,
      aspect: canvasObserver.width / canvasObserver.height,
      near: 0.1,
      far: 100,
    });

    const radius = Math.sqrt(
      params.observerX ** 2 + params.observerY ** 2 + params.observerZ ** 2
    );

    // Use OrbitCameraController to control the Observer camera
    const orbitController = new OrbitCameraController(
      observerCamera,
      canvasObserver,
      {
        radius,
        theta: Math.atan2(params.observerX, params.observerZ),
        phi: Math.acos(params.observerY / radius),
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
      observerCubeMesh.position.set(
        params.positionX,
        params.positionY,
        params.positionZ
      );

      mainCubeMesh.rotation.set(
        params.rotationX,
        params.rotationY,
        params.rotationZ
      );
      mainCubeMesh.scale.set(params.scale, params.scale, params.scale);
      mainCubeMesh.position.set(
        params.positionX,
        params.positionY,
        params.positionZ
      );

      // Update observer camera (OrbitController manages position and lookAt)
      observerCamera.fov = params.observerFov;

      // Update main orthographic camera
      mainCamera.left = params.mainLeft;
      mainCamera.right = params.mainRight;
      mainCamera.top = params.mainTop;
      mainCamera.bottom = params.mainBottom;
      mainCamera.near = params.mainNear;
      mainCamera.far = params.mainFar;

      // Update frustum helper
      orthographicCameraHelper.update();
      orthographicCameraHelper.visible = params.showFrustum;

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
