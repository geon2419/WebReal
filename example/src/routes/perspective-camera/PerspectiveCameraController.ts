import {
  BoxGeometry,
  Engine,
  Mesh,
  OrbitCameraController,
  PerspectiveCamera,
  PerspectiveCameraHelper,
  Renderer,
  Scene,
  VertexColorMaterial,
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
  showFrustum: boolean;
}

export interface PerspectiveCameraControllerOptions {
  canvasObserver: HTMLCanvasElement;
  canvasMain: HTMLCanvasElement;
  onStatusChange?: (status: string) => void;
}

export class PerspectiveCameraController {
  private _canvasObserver: HTMLCanvasElement;
  private _canvasMain: HTMLCanvasElement;
  private _onStatusChange?: (status: string) => void;

  private _disposed = false;

  private _engineObserver: Engine | null = null;
  private _engineMain: Engine | null = null;
  private _rendererObserver: Renderer | null = null;
  private _rendererMain: Renderer | null = null;

  private _sceneObserver: Scene | null = null;
  private _sceneMain: Scene | null = null;
  private _observerCamera: PerspectiveCamera | null = null;
  private _mainCamera: PerspectiveCamera | null = null;
  private _observerOrbit: OrbitCameraController | null = null;
  private _mainOrbit: OrbitCameraController | null = null;
  private _frustumHelper: PerspectiveCameraHelper | null = null;

  private _observerCubeMesh: Mesh | null = null;
  private _mainCubeMesh: Mesh | null = null;

  private _gui: GUI | null = null;
  private _resizeObserverObserver: ResizeObserver | null = null;
  private _resizeObserverMain: ResizeObserver | null = null;

  private _params: Params;

  constructor(options: PerspectiveCameraControllerOptions) {
    this._canvasObserver = options.canvasObserver;
    this._canvasMain = options.canvasMain;
    this._onStatusChange = options.onStatusChange;

    this._params = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      autoRotate: true,
      rotationSpeed: 1.0,
      scale: 1.0,
      observerX: 8.0,
      observerY: 3.0,
      observerZ: 8.0,
      observerFov: 60,
      mainFov: 60,
      mainNear: 0.5,
      mainFar: 5,
      showFrustum: true,
    };
  }

  async init(): Promise<void> {
    try {
      this._onStatusChange?.("Initializing WebGPU...");

      this._engineObserver = await Engine.create({
        canvas: this._canvasObserver,
      });
      this._engineMain = await Engine.create({ canvas: this._canvasMain });

      if (this._disposed) {
        this._engineObserver.dispose();
        this._engineMain.dispose();
        return;
      }

      this._rendererObserver = new Renderer(this._engineObserver);
      this._rendererObserver.setClearColor([0.1, 0.1, 0.1, 1]);

      this._rendererMain = new Renderer(this._engineMain);
      this._rendererMain.setClearColor([0.15, 0.1, 0.1, 1]);

      this._sceneObserver = new Scene();
      this._sceneMain = new Scene();

      this._gui = this._createGui(this._params);

      const faceColors = [
        Color.fromHex("#ff4d4d"),
        Color.fromHex("#4dff4d"),
        Color.fromHex("#4d4dff"),
        Color.fromHex("#ffff4d"),
        Color.fromHex("#ff4dff"),
        Color.fromHex("#4dffff"),
      ];

      const cubeGeometry = new BoxGeometry(2, 2, 2);
      const cubeMaterial = new VertexColorMaterial({ faceColors });

      this._observerCubeMesh = new Mesh(cubeGeometry, cubeMaterial);
      this._sceneObserver.add(this._observerCubeMesh);

      this._mainCubeMesh = new Mesh(cubeGeometry, cubeMaterial);
      this._sceneMain.add(this._mainCubeMesh);

      this._mainCamera = new PerspectiveCamera({
        fov: this._params.mainFov,
        near: this._params.mainNear,
        far: this._params.mainFar,
      });

      this._mainOrbit = new OrbitCameraController(
        this._mainCamera,
        this._canvasMain,
        {
          radius: 4,
          theta: 0,
          phi: Math.PI / 2,
        },
      );

      this._frustumHelper = new PerspectiveCameraHelper(this._mainCamera, {
        nearColor: Color.GREEN,
        farColor: Color.RED,
        sideColor: Color.YELLOW,
        coneColor: Color.fromHex("#8080ff"),
      });
      this._sceneObserver.add(this._frustumHelper);

      this._observerCamera = new PerspectiveCamera({
        fov: this._params.observerFov,
        near: 0.1,
        far: 100,
      });

      const radius = Math.sqrt(
        this._params.observerX ** 2 +
          this._params.observerY ** 2 +
          this._params.observerZ ** 2,
      );

      this._observerOrbit = new OrbitCameraController(
        this._observerCamera,
        this._canvasObserver,
        {
          radius,
          theta: Math.atan2(this._params.observerX, this._params.observerZ),
          phi: Math.acos(this._params.observerY / radius),
        },
      );

      this._setupResizeHandling();

      this._onStatusChange?.("Running");
      this._engineObserver.run((deltaTime: number) => {
        if (this._disposed) {
          return;
        }

        const observerCubeMesh = this._observerCubeMesh;
        const mainCubeMesh = this._mainCubeMesh;
        const observerCamera = this._observerCamera;
        const mainCamera = this._mainCamera;
        const frustumHelper = this._frustumHelper;
        const rendererObserver = this._rendererObserver;
        const rendererMain = this._rendererMain;
        const sceneObserver = this._sceneObserver;
        const sceneMain = this._sceneMain;

        if (
          !observerCubeMesh ||
          !mainCubeMesh ||
          !observerCamera ||
          !mainCamera ||
          !frustumHelper ||
          !rendererObserver ||
          !rendererMain ||
          !sceneObserver ||
          !sceneMain
        ) {
          return;
        }

        if (this._params.autoRotate) {
          this._params.rotationX +=
            deltaTime * this._params.rotationSpeed * 0.5;
          this._params.rotationY += deltaTime * this._params.rotationSpeed;
        }

        observerCubeMesh.rotation.set(
          this._params.rotationX,
          this._params.rotationY,
          this._params.rotationZ,
        );
        observerCubeMesh.scale.set(
          this._params.scale,
          this._params.scale,
          this._params.scale,
        );

        mainCubeMesh.rotation.set(
          this._params.rotationX,
          this._params.rotationY,
          this._params.rotationZ,
        );
        mainCubeMesh.scale.set(
          this._params.scale,
          this._params.scale,
          this._params.scale,
        );

        observerCamera.fov = this._params.observerFov;

        mainCamera.fov = this._params.mainFov;
        mainCamera.near = this._params.mainNear;
        mainCamera.far = this._params.mainFar;

        frustumHelper.update();
        frustumHelper.visible = this._params.showFrustum;

        rendererObserver.render(sceneObserver, observerCamera);
        rendererMain.render(sceneMain, mainCamera);
      });
    } catch (error) {
      this._onStatusChange?.("Failed");
      this.dispose();
      throw error;
    }
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._onStatusChange = undefined;

    if (this._resizeObserverObserver) {
      this._resizeObserverObserver.disconnect();
      this._resizeObserverObserver = null;
    }
    if (this._resizeObserverMain) {
      this._resizeObserverMain.disconnect();
      this._resizeObserverMain = null;
    }

    this._observerOrbit?.dispose();
    this._mainOrbit?.dispose();
    this._observerOrbit = null;
    this._mainOrbit = null;

    this._observerCamera?.dispose();
    this._mainCamera?.dispose();
    this._observerCamera = null;
    this._mainCamera = null;

    this._gui?.destroy();
    this._gui = null;

    this._rendererObserver?.dispose();
    this._rendererMain?.dispose();
    this._rendererObserver = null;
    this._rendererMain = null;

    this._engineObserver?.dispose();
    this._engineMain?.dispose();
    this._engineObserver = null;
    this._engineMain = null;

    this._sceneObserver = null;
    this._sceneMain = null;
    this._frustumHelper = null;
    this._observerCubeMesh = null;
    this._mainCubeMesh = null;
  }

  private _createGui(params: Params): GUI {
    const gui = new GUI({ title: "Perspective Camera Demo" });
    gui.domElement.style.zIndex = "1000";

    const cubeFolder = gui.addFolder("Cube");
    cubeFolder.add(params, "autoRotate").name("Auto Rotate");
    cubeFolder.add(params, "rotationSpeed", 0, 3).name("Rotation Speed");
    cubeFolder.add(params, "scale", 0.1, 3).name("Scale");

    const observerFolder = gui.addFolder("Observer Camera (Left)");
    observerFolder
      .add(params, "observerX", -15, 15)
      .name("Position X")
      .onChange(() => this._syncObserverOrbitFromParams());
    observerFolder
      .add(params, "observerY", -15, 15)
      .name("Position Y")
      .onChange(() => this._syncObserverOrbitFromParams());
    observerFolder
      .add(params, "observerZ", -15, 15)
      .name("Position Z")
      .onChange(() => this._syncObserverOrbitFromParams());
    observerFolder.add(params, "observerFov", 30, 120).name("FOV");

    const mainFolder = gui.addFolder("Main Camera (Right)");
    mainFolder.add(params, "showFrustum").name("Show Frustum");
    mainFolder.add(params, "mainFov", 30, 120).name("FOV");
    mainFolder.add(params, "mainNear", 0.1, 2).name("Near Plane");
    mainFolder.add(params, "mainFar", 2, 10).name("Far Plane");

    return gui;
  }

  private _syncObserverOrbitFromParams(): void {
    const orbit = this._observerOrbit;
    if (!orbit) {
      return;
    }

    const radius = Math.max(
      1e-6,
      Math.sqrt(
        this._params.observerX ** 2 +
          this._params.observerY ** 2 +
          this._params.observerZ ** 2,
      ),
    );

    orbit.radius = radius;
    orbit.theta = Math.atan2(this._params.observerX, this._params.observerZ);
    orbit.phi = Math.acos(this._params.observerY / radius);
    orbit.update();
  }

  private _setupResizeHandling(): void {
    const observerCamera = this._observerCamera;
    const mainCamera = this._mainCamera;
    if (!observerCamera || !mainCamera) {
      return;
    }

    const updateObserverAspect = () => {
      if (!this._observerCamera) {
        return;
      }
      const rect = this._canvasObserver.getBoundingClientRect();
      this._observerCamera.aspect =
        Math.max(1e-6, rect.width) / Math.max(1e-6, rect.height);
    };

    const updateMainAspect = () => {
      if (!this._mainCamera) {
        return;
      }
      const rect = this._canvasMain.getBoundingClientRect();
      this._mainCamera.aspect =
        Math.max(1e-6, rect.width) / Math.max(1e-6, rect.height);
    };

    updateObserverAspect();
    updateMainAspect();

    this._resizeObserverObserver = new ResizeObserver(() => {
      updateObserverAspect();
    });
    this._resizeObserverObserver.observe(this._canvasObserver);

    this._resizeObserverMain = new ResizeObserver(() => {
      updateMainAspect();
    });
    this._resizeObserverMain.observe(this._canvasMain);
  }
}
