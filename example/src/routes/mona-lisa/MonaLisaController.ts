import {
  AmbientLight,
  Engine,
  Mesh,
  ParallaxPBRMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Renderer,
  Scene,
  Texture,
} from "@web-real/core";
import { Color, Vector3 } from "@web-real/math";
import GUI from "lil-gui";

interface ParallaxPBRParams {
  // PBR Parameters
  metalness: number;
  roughness: number;
  aoMapIntensity: number;
  envMapIntensity: number;

  // Parallax Parameters
  depthScale: number;
  normalScale: number;
  selfShadowEnabled: boolean;
  selfShadowStrength: number;

  // Ambient Light
  ambientIntensity: number;

  // Mouse Light (Main)
  mouseLightEnabled: boolean;
  mouseLightPosZ: number;
  mouseLightIntensity: number;
  mouseLightColorR: number;
  mouseLightColorG: number;
  mouseLightColorB: number;

  // Fill Light (Secondary)
  fillLightEnabled: boolean;
  fillLightPosX: number;
  fillLightPosY: number;
  fillLightPosZ: number;
  fillLightIntensity: number;
  fillLightColorR: number;
  fillLightColorG: number;
  fillLightColorB: number;

  // Mouse Control
  mouseEnabled: boolean;
  mouseRange: number;

  // Tilt Effect
  tiltEnabled: boolean;
  tiltAmount: number;
}

export interface MonaLisaControllerOptions {
  canvas: HTMLCanvasElement;
  onStatusChange?: (status: string) => void;
}

export class MonaLisaController {
  private _canvas: HTMLCanvasElement;
  private _onStatusChange?: (status: string) => void;

  private _disposed = false;
  private _removeInteractionListeners: (() => void) | null = null;

  private _engine: Engine | null = null;
  private _renderer: Renderer | null = null;
  private _scene: Scene | null = null;
  private _camera: PerspectiveCamera | null = null;
  private _mesh: Mesh | null = null;
  private _material: ParallaxPBRMaterial | null = null;

  private _ambientLight: AmbientLight | null = null;
  private _mouseLight: PointLight | null = null;
  private _fillLight: PointLight | null = null;

  private _gui: GUI | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  private _mouseX = 0;
  private _mouseY = 0;
  private _targetTiltX = 0;
  private _targetTiltY = 0;
  private _currentTiltX = 0;
  private _currentTiltY = 0;

  private _params: ParallaxPBRParams;

  constructor(options: MonaLisaControllerOptions) {
    this._canvas = options.canvas;
    this._onStatusChange = options.onStatusChange;

    this._params = {
      // PBR Parameters
      metalness: 0.0,
      roughness: 0.6,
      aoMapIntensity: 1.0,
      envMapIntensity: 0.0,

      // Parallax Parameters
      depthScale: 0.05,
      normalScale: 1.0,
      selfShadowEnabled: false,
      selfShadowStrength: 0.35,

      // Ambient Light
      ambientIntensity: 0.7,

      // Mouse Light (Main)
      mouseLightEnabled: true,
      mouseLightPosZ: 1.0,
      mouseLightIntensity: 0.4,
      mouseLightColorR: 1.0,
      mouseLightColorG: 0.95,
      mouseLightColorB: 0.9,

      // Fill Light (Secondary)
      fillLightEnabled: true,
      fillLightPosX: -0.8,
      fillLightPosY: 0.5,
      fillLightPosZ: 0.8,
      fillLightIntensity: 0.3,
      fillLightColorR: 1.0,
      fillLightColorG: 0.9,
      fillLightColorB: 0.7,

      // Mouse Control
      mouseEnabled: true,
      mouseRange: 2.0,

      // Tilt Effect
      tiltEnabled: true,
      tiltAmount: 0.3,
    };
  }

  async init(): Promise<void> {
    try {
      this._onStatusChange?.("Initializing WebGPU...");

      this._engine = await Engine.create({ canvas: this._canvas });
      if (this._disposed) {
        this._engine.dispose();
        return;
      }

      this._renderer = new Renderer(this._engine);
      this._renderer.setClearColor([0.02, 0.02, 0.03, 1]);

      this._scene = new Scene();

      this._onStatusChange?.("Loading textures...");
      const device = this._engine.device;
      const albedoUrl = new URL("./assets/monalisa.jpg", import.meta.url).toString();
      const depthUrl = new URL("./assets/monalisa-depth-map.png", import.meta.url).toString();
      const normalUrl = new URL("./assets/monalisa-normal-map.png", import.meta.url).toString();
      const pbrUrl = new URL("./assets/monalisa-pbr.png", import.meta.url).toString();

      const [albedoTexture, depthTexture, normalTexture, pbrTexture] =
        await Promise.all([
          Texture.fromURL(device, albedoUrl),
          Texture.fromURL(device, depthUrl),
          Texture.fromURL(device, normalUrl),
          Texture.fromURL(device, pbrUrl),
        ]);

      if (this._disposed) {
        return;
      }

      const imageWidth = 560;
      const imageHeight = 1000;
      const imageAspectRatio = imageWidth / imageHeight;

      const maxViewSize = 1.6;
      const planeHeight = maxViewSize;
      const planeWidth = planeHeight * imageAspectRatio;

      const planeGeometry = new PlaneGeometry({
        width: planeWidth,
        height: planeHeight,
        widthSegments: 1,
        heightSegments: 1,
        orientation: "XY",
      });

      this._material = new ParallaxPBRMaterial({
        albedo: albedoTexture,
        depth: depthTexture,
        normal: normalTexture,

        // PBR texture maps (R=AO, G=Roughness, B=Metalness)
        aoMap: pbrTexture,
        roughnessMap: pbrTexture,
        metalnessMap: pbrTexture,

        // PBR settings
        metalness: this._params.metalness,
        roughness: this._params.roughness,
        aoMapIntensity: this._params.aoMapIntensity,
        envMapIntensity: this._params.envMapIntensity,

        // Parallax settings
        depthScale: this._params.depthScale,
        normalScale: this._params.normalScale,
        generateNormalFromDepth: false,
        selfShadow: this._params.selfShadowEnabled,
        selfShadowStrength: this._params.selfShadowStrength,
      });

      this._mesh = new Mesh(planeGeometry, this._material);
      this._scene.add(this._mesh);

      this._ambientLight = new AmbientLight(
        new Color(1.0, 1.0, 1.0),
        this._params.ambientIntensity
      );
      this._scene.add(this._ambientLight);

      this._mouseLight = new PointLight(
        new Color(
          this._params.mouseLightColorR,
          this._params.mouseLightColorG,
          this._params.mouseLightColorB
        ),
        this._params.mouseLightIntensity,
        20,
        "quadratic"
      );
      this._mouseLight.position.set(0, 0, this._params.mouseLightPosZ);
      this._scene.add(this._mouseLight);

      this._fillLight = new PointLight(
        new Color(
          this._params.fillLightColorR,
          this._params.fillLightColorG,
          this._params.fillLightColorB
        ),
        this._params.fillLightIntensity,
        20,
        "quadratic"
      );
      this._fillLight.position.set(
        this._params.fillLightPosX,
        this._params.fillLightPosY,
        this._params.fillLightPosZ
      );
      this._scene.add(this._fillLight);

      this._camera = new PerspectiveCamera({
        fov: 45,
        near: 0.1,
        far: 100,
      });

      const fovRadians = (this._camera.fov * Math.PI) / 180;
      const viewHeight = 2.0;
      const distance = viewHeight / 2 / Math.tan(fovRadians / 2);

      this._camera.position.set(0, 0, distance);
      this._camera.lookAt(new Vector3(0, 0, 0));

      this._setupInteractions();
      this._setupResizeHandling();
      this._setupGui();

      this._onStatusChange?.("Running");
      this._engine.run(() => {
        if (this._disposed) {
          return;
        }

        const mesh = this._mesh;
        const material = this._material;
        const scene = this._scene;
        const camera = this._camera;
        const renderer = this._renderer;
        const ambientLight = this._ambientLight;
        const mouseLight = this._mouseLight;

        if (!mesh || !material || !scene || !camera || !renderer) {
          return;
        }

        this._updateTilt(mesh);

        material.metalness = this._params.metalness;
        material.roughness = this._params.roughness;
        material.aoMapIntensity = this._params.aoMapIntensity;
        material.envMapIntensity = this._params.envMapIntensity;

        material.depthScale = this._params.depthScale;
        material.normalScale = this._params.normalScale;
        material.selfShadow = this._params.selfShadowEnabled;
        material.selfShadowStrength = this._params.selfShadowStrength;

        if (ambientLight) {
          ambientLight.intensity = this._params.ambientIntensity;
        }

        if (mouseLight) {
          const lightIntensity = this._params.mouseLightEnabled
            ? this._params.mouseLightIntensity
            : 0;
          mouseLight.intensity = lightIntensity;

          if (this._params.mouseEnabled) {
            mouseLight.position.set(
              this._mouseX * this._params.mouseRange,
              this._mouseY * this._params.mouseRange,
              this._params.mouseLightPosZ
            );
          } else {
            mouseLight.position.set(0, 0, this._params.mouseLightPosZ);
          }
        }

        const fillLight = this._fillLight;
        if (fillLight) {
          fillLight.position.set(
            this._params.fillLightPosX,
            this._params.fillLightPosY,
            this._params.fillLightPosZ
          );
          fillLight.intensity = this._params.fillLightEnabled
            ? this._params.fillLightIntensity
            : 0;
        }

        renderer.render(scene, camera);
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

    this._removeInteractionListeners?.();
    this._removeInteractionListeners = null;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    this._gui?.destroy();
    this._gui = null;

    this._renderer?.dispose();
    this._engine?.dispose();
    this._engine = null;

    this._renderer = null;
    this._scene = null;
    this._camera = null;
    this._mesh = null;
    this._material = null;
    this._ambientLight = null;
    this._mouseLight = null;
    this._fillLight = null;
  }

  private _setupInteractions(): void {
    const handleMouseMove = (event: MouseEvent) => {
      const rect = this._canvas.getBoundingClientRect();
      const width = Math.max(1e-6, rect.width);
      const height = Math.max(1e-6, rect.height);

      this._mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
      this._mouseY = -((event.clientY - rect.top) / height) * 2 + 1;

      if (this._params.tiltEnabled) {
        this._targetTiltX = this._mouseY * this._params.tiltAmount;
        this._targetTiltY = -this._mouseX * this._params.tiltAmount;
      }
    };

    const handleMouseLeave = () => {
      this._mouseX = 0;
      this._mouseY = 0;
      this._targetTiltX = 0;
      this._targetTiltY = 0;
    };

    this._canvas.addEventListener("mousemove", handleMouseMove);
    this._canvas.addEventListener("mouseleave", handleMouseLeave);

    this._removeInteractionListeners = () => {
      this._canvas.removeEventListener("mousemove", handleMouseMove);
      this._canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }

  private _setupResizeHandling(): void {
    if (!this._camera) {
      return;
    }

    this._resizeObserver = new ResizeObserver(() => {
      if (!this._camera) {
        return;
      }
      const rect = this._canvas.getBoundingClientRect();
      this._camera.aspect =
        Math.max(1e-6, rect.width) / Math.max(1e-6, rect.height);
    });
    this._resizeObserver.observe(this._canvas);

    const rect = this._canvas.getBoundingClientRect();
    this._camera.aspect =
      Math.max(1e-6, rect.width) / Math.max(1e-6, rect.height);
  }

  private _setupGui(): void {
    const gui = new GUI({ title: "ParallaxPBR 2.5D Controls" });
    gui.domElement.style.zIndex = "1000";
    this._gui = gui;

    const updateMouseLightColor = () => {
      if (!this._mouseLight) return;
      this._mouseLight.color = new Color(
        this._params.mouseLightColorR,
        this._params.mouseLightColorG,
        this._params.mouseLightColorB
      );
    };

    const updateFillLightColor = () => {
      if (!this._fillLight) return;
      this._fillLight.color = new Color(
        this._params.fillLightColorR,
        this._params.fillLightColorG,
        this._params.fillLightColorB
      );
    };

    const updateFillLightPosition = () => {
      if (!this._fillLight) return;
      this._fillLight.position.set(
        this._params.fillLightPosX,
        this._params.fillLightPosY,
        this._params.fillLightPosZ
      );
    };

    // PBR Folder
    const pbrFolder = gui.addFolder("PBR Material");
    pbrFolder.add(this._params, "metalness", 0, 1, 0.01).name("Metalness");
    pbrFolder.add(this._params, "roughness", 0.04, 1, 0.01).name("Roughness");
    pbrFolder
      .add(this._params, "aoMapIntensity", 0, 1, 0.01)
      .name("AO Intensity");
    pbrFolder
      .add(this._params, "envMapIntensity", 0, 2, 0.01)
      .name("Env Intensity");

    // Parallax Folder
    const parallaxFolder = gui.addFolder("Parallax Effect");
    parallaxFolder
      .add(this._params, "depthScale", 0.01, 0.15, 0.005)
      .name("Depth Scale");
    parallaxFolder
      .add(this._params, "normalScale", 0.0, 3.0, 0.1)
      .name("Normal Scale");

    // Shadow Folder
    const shadowFolder = gui.addFolder("Self Shadow");
    shadowFolder.add(this._params, "selfShadowEnabled").name("Enabled");
    shadowFolder
      .add(this._params, "selfShadowStrength", 0, 1, 0.05)
      .name("Strength");

    // Ambient Folder
    const ambientFolder = gui.addFolder("Ambient Light");
    ambientFolder
      .add(this._params, "ambientIntensity", 0, 1.0, 0.01)
      .name("Intensity");

    const mouseLightFolder = gui.addFolder("Mouse Light (Main)");
    mouseLightFolder.add(this._params, "mouseLightEnabled").name("Enabled");
    mouseLightFolder
      .add(this._params, "mouseLightPosZ", 0.1, 2.0, 0.1)
      .name("Distance");
    mouseLightFolder
      .add(this._params, "mouseLightIntensity", 0.1, 2.0, 0.1)
      .name("Intensity");
    const mouseLightColorFolder = mouseLightFolder.addFolder("Color");
    mouseLightColorFolder
      .add(this._params, "mouseLightColorR", 0, 1, 0.01)
      .name("Red")
      .onChange(updateMouseLightColor);
    mouseLightColorFolder
      .add(this._params, "mouseLightColorG", 0, 1, 0.01)
      .name("Green")
      .onChange(updateMouseLightColor);
    mouseLightColorFolder
      .add(this._params, "mouseLightColorB", 0, 1, 0.01)
      .name("Blue")
      .onChange(updateMouseLightColor);

    const fillLightFolder = gui.addFolder("Fill Light (Secondary)");
    fillLightFolder.add(this._params, "fillLightEnabled").name("Enabled");
    fillLightFolder
      .add(this._params, "fillLightPosX", -2.0, 2.0, 0.1)
      .name("Position X")
      .onChange(updateFillLightPosition);
    fillLightFolder
      .add(this._params, "fillLightPosY", -2.0, 2.0, 0.1)
      .name("Position Y")
      .onChange(updateFillLightPosition);
    fillLightFolder
      .add(this._params, "fillLightPosZ", 0.1, 2.0, 0.1)
      .name("Position Z")
      .onChange(updateFillLightPosition);
    fillLightFolder
      .add(this._params, "fillLightIntensity", 0.1, 2.0, 0.1)
      .name("Intensity");
    const fillLightColorFolder = fillLightFolder.addFolder("Color");
    fillLightColorFolder
      .add(this._params, "fillLightColorR", 0, 1, 0.01)
      .name("Red")
      .onChange(updateFillLightColor);
    fillLightColorFolder
      .add(this._params, "fillLightColorG", 0, 1, 0.01)
      .name("Green")
      .onChange(updateFillLightColor);
    fillLightColorFolder
      .add(this._params, "fillLightColorB", 0, 1, 0.01)
      .name("Blue")
      .onChange(updateFillLightColor);

    const mouseFolder = gui.addFolder("Mouse Control");
    mouseFolder.add(this._params, "mouseEnabled").name("Enabled");
    mouseFolder.add(this._params, "mouseRange", 0.0, 2.0, 0.1).name("Range");

    const tiltFolder = gui.addFolder("Tilt Effect");
    tiltFolder.add(this._params, "tiltEnabled").name("Enabled");
    tiltFolder.add(this._params, "tiltAmount", 0.0, 1.0, 0.05).name("Amount");
  }

  private _updateTilt(mesh: Mesh): void {
    const lerpFactor = 0.1;
    this._currentTiltX += (this._targetTiltX - this._currentTiltX) * lerpFactor;
    this._currentTiltY += (this._targetTiltY - this._currentTiltY) * lerpFactor;

    if (this._params.tiltEnabled) {
      mesh.rotation.set(this._currentTiltX, this._currentTiltY, 0);
    } else {
      mesh.rotation.set(0, 0, 0);
    }
  }
}
