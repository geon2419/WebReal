import {
  Engine,
  Renderer,
  PlaneGeometry,
  ParallaxPBRMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
  PointLight,
  AmbientLight,
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

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  const canvasSize = 500;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasSize * dpr;
  canvas.height = canvasSize * dpr;
  canvas.style.width = `${canvasSize}px`;
  canvas.style.height = `${canvasSize}px`;

  const imageWidth = 560;
  const imageHeight = 1000;
  const imageAspectRatio = imageWidth / imageHeight;

  try {
    const engine = await Engine.create({ canvas });
    const renderer = new Renderer(engine);
    renderer.setClearColor([0.02, 0.02, 0.03]);

    const params: ParallaxPBRParams = {
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

    const gui = new GUI({ title: "ParallaxPBR 2.5D Controls" });

    // PBR Folder
    const pbrFolder = gui.addFolder("PBR Material");
    pbrFolder.add(params, "metalness", 0, 1, 0.01).name("Metalness");
    pbrFolder.add(params, "roughness", 0.04, 1, 0.01).name("Roughness");
    pbrFolder.add(params, "aoMapIntensity", 0, 1, 0.01).name("AO Intensity");
    pbrFolder.add(params, "envMapIntensity", 0, 2, 0.01).name("Env Intensity");

    // Parallax Folder
    const parallaxFolder = gui.addFolder("Parallax Effect");
    parallaxFolder
      .add(params, "depthScale", 0.01, 0.15, 0.005)
      .name("Depth Scale");
    parallaxFolder
      .add(params, "normalScale", 0.0, 3.0, 0.1)
      .name("Normal Scale");

    // Shadow Folder
    const shadowFolder = gui.addFolder("Self Shadow");
    shadowFolder.add(params, "selfShadowEnabled").name("Enabled");
    shadowFolder.add(params, "selfShadowStrength", 0, 1, 0.05).name("Strength");

    // Ambient Folder
    const ambientFolder = gui.addFolder("Ambient Light");
    ambientFolder
      .add(params, "ambientIntensity", 0, 1.0, 0.01)
      .name("Intensity");

    const mouseLightFolder = gui.addFolder("Mouse Light (Main)");
    mouseLightFolder.add(params, "mouseLightEnabled").name("Enabled");
    mouseLightFolder
      .add(params, "mouseLightPosZ", 0.1, 2.0, 0.1)
      .name("Distance");
    mouseLightFolder
      .add(params, "mouseLightIntensity", 0.1, 2.0, 0.1)
      .name("Intensity");
    const mouseLightColorFolder = mouseLightFolder.addFolder("Color");
    mouseLightColorFolder
      .add(params, "mouseLightColorR", 0, 1, 0.01)
      .name("Red");
    mouseLightColorFolder
      .add(params, "mouseLightColorG", 0, 1, 0.01)
      .name("Green");
    mouseLightColorFolder
      .add(params, "mouseLightColorB", 0, 1, 0.01)
      .name("Blue");

    const fillLightFolder = gui.addFolder("Fill Light (Secondary)");
    fillLightFolder.add(params, "fillLightEnabled").name("Enabled");
    fillLightFolder
      .add(params, "fillLightPosX", -2.0, 2.0, 0.1)
      .name("Position X");
    fillLightFolder
      .add(params, "fillLightPosY", -2.0, 2.0, 0.1)
      .name("Position Y");
    fillLightFolder
      .add(params, "fillLightPosZ", 0.1, 2.0, 0.1)
      .name("Position Z");
    fillLightFolder
      .add(params, "fillLightIntensity", 0.1, 2.0, 0.1)
      .name("Intensity");
    const fillLightColorFolder = fillLightFolder.addFolder("Color");
    fillLightColorFolder.add(params, "fillLightColorR", 0, 1, 0.01).name("Red");
    fillLightColorFolder
      .add(params, "fillLightColorG", 0, 1, 0.01)
      .name("Green");
    fillLightColorFolder
      .add(params, "fillLightColorB", 0, 1, 0.01)
      .name("Blue");

    const mouseFolder = gui.addFolder("Mouse Control");
    mouseFolder.add(params, "mouseEnabled").name("Enabled");
    mouseFolder.add(params, "mouseRange", 0.0, 2.0, 0.1).name("Range");

    const tiltFolder = gui.addFolder("Tilt Effect");
    tiltFolder.add(params, "tiltEnabled").name("Enabled");
    tiltFolder.add(params, "tiltAmount", 0.0, 1.0, 0.05).name("Amount");

    const [albedoTexture, depthTexture, normalTexture, pbrTexture] =
      await Promise.all([
        Texture.fromURL(engine.device, "/assets/monalisa.jpg"),
        Texture.fromURL(engine.device, "/assets/monalisa-depth-map.png"),
        Texture.fromURL(engine.device, "/assets/monalisa-normal-map.png"),
        Texture.fromURL(engine.device, "/assets/monalisa-pbr.png"),
      ]);

    const scene = new Scene();

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

    // Create ParallaxPBR material
    const parallaxPBRMaterial = new ParallaxPBRMaterial({
      albedo: albedoTexture,
      depth: depthTexture,
      normal: normalTexture,

      // PBR texture maps (R=AO, G=Roughness, B=Metalness)
      aoMap: pbrTexture,
      roughnessMap: pbrTexture,
      metalnessMap: pbrTexture,

      // PBR settings
      metalness: params.metalness,
      roughness: params.roughness,
      aoMapIntensity: params.aoMapIntensity,
      envMapIntensity: params.envMapIntensity,

      // Parallax settings
      depthScale: params.depthScale,
      normalScale: params.normalScale,
      generateNormalFromDepth: false,
      selfShadow: params.selfShadowEnabled,
      selfShadowStrength: params.selfShadowStrength,
    });

    const mesh = new Mesh(planeGeometry, parallaxPBRMaterial);
    scene.add(mesh);

    const ambientLight = new AmbientLight(
      new Color(1.0, 1.0, 1.0),
      params.ambientIntensity
    );
    scene.add(ambientLight);

    const mouseLight = new PointLight(
      new Color(
        params.mouseLightColorR,
        params.mouseLightColorG,
        params.mouseLightColorB
      ),
      params.mouseLightIntensity,
      20,
      "quadratic"
    );
    mouseLight.position.set(0, 0, params.mouseLightPosZ);
    scene.add(mouseLight);

    const fillLight = new PointLight(
      new Color(
        params.fillLightColorR,
        params.fillLightColorG,
        params.fillLightColorB
      ),
      params.fillLightIntensity,
      20,
      "quadratic"
    );
    fillLight.position.set(
      params.fillLightPosX,
      params.fillLightPosY,
      params.fillLightPosZ
    );
    scene.add(fillLight);

    const camera = new PerspectiveCamera({
      fov: 45,
      near: 0.1,
      far: 100,
    });
    camera.updateAspect(canvas);

    const fovRadians = (45 * Math.PI) / 180;
    const viewHeight = 2.0;
    const distance = viewHeight / 2 / Math.tan(fovRadians / 2);

    camera.position.set(0, 0, distance);
    camera.lookAt(new Vector3(0, 0, 0));

    let mouseX = 0;
    let mouseY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (params.tiltEnabled) {
        targetTiltX = mouseY * params.tiltAmount;
        targetTiltY = -mouseX * params.tiltAmount;
      }
    });

    canvas.addEventListener("mouseleave", () => {
      mouseX = 0;
      mouseY = 0;
      targetTiltX = 0;
      targetTiltY = 0;
    });

    engine.run(() => {
      const lerpFactor = 0.1;
      currentTiltX += (targetTiltX - currentTiltX) * lerpFactor;
      currentTiltY += (targetTiltY - currentTiltY) * lerpFactor;

      if (params.tiltEnabled) {
        mesh.rotation.set(currentTiltX, currentTiltY, 0);
      } else {
        mesh.rotation.set(0, 0, 0);
      }

      // Update PBR material parameters
      parallaxPBRMaterial.metalness = params.metalness;
      parallaxPBRMaterial.roughness = params.roughness;
      parallaxPBRMaterial.aoMapIntensity = params.aoMapIntensity;
      parallaxPBRMaterial.envMapIntensity = params.envMapIntensity;

      // Update Parallax parameters
      parallaxPBRMaterial.depthScale = params.depthScale;
      parallaxPBRMaterial.normalScale = params.normalScale;
      parallaxPBRMaterial.selfShadow = params.selfShadowEnabled;
      parallaxPBRMaterial.selfShadowStrength = params.selfShadowStrength;

      // Update ambient light
      ambientLight.intensity = params.ambientIntensity;

      if (params.mouseEnabled) {
        mouseLight.position.set(
          mouseX * params.mouseRange,
          mouseY * params.mouseRange,
          params.mouseLightPosZ
        );
      } else {
        mouseLight.position.set(0, 0, params.mouseLightPosZ);
      }

      if (params.mouseLightEnabled) {
        mouseLight.intensity = params.mouseLightIntensity;
        mouseLight.color = new Color(
          params.mouseLightColorR,
          params.mouseLightColorG,
          params.mouseLightColorB
        );
      } else {
        mouseLight.intensity = 0;
      }

      fillLight.position.set(
        params.fillLightPosX,
        params.fillLightPosY,
        params.fillLightPosZ
      );
      if (params.fillLightEnabled) {
        fillLight.intensity = params.fillLightIntensity;
        fillLight.color = new Color(
          params.fillLightColorR,
          params.fillLightColorG,
          params.fillLightColorB
        );
      } else {
        fillLight.intensity = 0;
      }

      renderer.render(scene, camera);
    });
  } catch (error) {
    console.error(error);
  }
}

main();
