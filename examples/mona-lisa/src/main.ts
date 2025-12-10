import {
  Engine,
  Renderer,
  PlaneGeometry,
  ParallaxMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
  PointLight,
  AmbientLight,
  Texture,
} from "@web-real/core";
import { Color, Vector3 } from "@web-real/math";
import GUI from "lil-gui";

interface ParallaxParams {
  // Parallax material params
  depthScale: number;
  normalScale: number;
  shininess: number;
  // Ambient light params
  ambientIntensity: number;
  // Light 1 params (main light)
  light1Enabled: boolean;
  light1PosZ: number;
  light1Intensity: number;
  light1ColorR: number;
  light1ColorG: number;
  light1ColorB: number;
  // Light 2 params (secondary light)
  light2Enabled: boolean;
  light2PosX: number;
  light2PosY: number;
  light2PosZ: number;
  light2Intensity: number;
  light2ColorR: number;
  light2ColorG: number;
  light2ColorB: number;
  // Mouse control
  mouseEnabled: boolean;
  mouseRange: number;
}

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  // Image dimensions
  const imageWidth = 560;
  const imageHeight = 1000;
  const imageAspectRatio = imageWidth / imageHeight;

  function updateCanvasSize() {
    const container = canvas.parentElement!;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    let displayWidth: number;
    let displayHeight: number;

    // Fit image to container while maintaining aspect ratio
    if (containerAspectRatio > imageAspectRatio) {
      // Container is wider, fit to height
      displayHeight = containerHeight;
      displayWidth = displayHeight * imageAspectRatio;
    } else {
      // Container is taller, fit to width
      displayWidth = containerWidth;
      displayHeight = displayWidth / imageAspectRatio;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(displayWidth * dpr);
    const height = Math.floor(displayHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
    }
  }

  updateCanvasSize();
  window.addEventListener("resize", updateCanvasSize);

  try {
    const engine = await Engine.create({ canvas });
    const renderer = new Renderer(engine);
    renderer.setClearColor([0.02, 0.02, 0.03]);

    // GUI parameters
    const params: ParallaxParams = {
      // Parallax material params
      depthScale: 0.05,
      normalScale: 1.0,
      shininess: 64,
      // Ambient light params
      ambientIntensity: 0.5,
      // Light 1 params (main light - mouse controlled)
      light1Enabled: true,
      light1PosZ: 1.0,
      light1Intensity: 0.5,
      light1ColorR: 1.0,
      light1ColorG: 1.0,
      light1ColorB: 1.0,
      // Light 2 params (secondary fixed light)
      light2Enabled: true,
      light2PosX: -0.8,
      light2PosY: 0.5,
      light2PosZ: 0.8,
      light2Intensity: 0.3,
      light2ColorR: 1.0,
      light2ColorG: 0.9,
      light2ColorB: 0.7,
      // Mouse control
      mouseEnabled: true,
      mouseRange: 2.0,
    };

    const gui = new GUI({ title: "2.5D Parallax Controls" });

    const parallaxFolder = gui.addFolder("Parallax Effect");
    parallaxFolder
      .add(params, "depthScale", 0.01, 0.15, 0.005)
      .name("Depth Scale");
    parallaxFolder
      .add(params, "normalScale", 0.5, 2.0, 0.1)
      .name("Normal Scale");
    parallaxFolder.add(params, "shininess", 1, 128, 1).name("Shininess");

    const ambientFolder = gui.addFolder("Ambient Light");
    ambientFolder
      .add(params, "ambientIntensity", 0, 1.0, 0.01)
      .name("Intensity");

    const light1Folder = gui.addFolder("Light 1 (Main)");
    light1Folder.add(params, "light1Enabled").name("Enabled");
    light1Folder.add(params, "light1PosZ", 0.1, 2.0, 0.1).name("Distance");
    light1Folder
      .add(params, "light1Intensity", 0.1, 2.0, 0.1)
      .name("Intensity");
    const light1ColorFolder = light1Folder.addFolder("Color");
    light1ColorFolder.add(params, "light1ColorR", 0, 1, 0.01).name("Red");
    light1ColorFolder.add(params, "light1ColorG", 0, 1, 0.01).name("Green");
    light1ColorFolder.add(params, "light1ColorB", 0, 1, 0.01).name("Blue");

    const light2Folder = gui.addFolder("Light 2 (Secondary)");
    light2Folder.add(params, "light2Enabled").name("Enabled");
    light2Folder.add(params, "light2PosX", -2.0, 2.0, 0.1).name("Position X");
    light2Folder.add(params, "light2PosY", -2.0, 2.0, 0.1).name("Position Y");
    light2Folder.add(params, "light2PosZ", 0.1, 2.0, 0.1).name("Position Z");
    light2Folder
      .add(params, "light2Intensity", 0.1, 2.0, 0.1)
      .name("Intensity");
    const light2ColorFolder = light2Folder.addFolder("Color");
    light2ColorFolder.add(params, "light2ColorR", 0, 1, 0.01).name("Red");
    light2ColorFolder.add(params, "light2ColorG", 0, 1, 0.01).name("Green");
    light2ColorFolder.add(params, "light2ColorB", 0, 1, 0.01).name("Blue");

    const mouseFolder = gui.addFolder("Mouse Control");
    mouseFolder.add(params, "mouseEnabled").name("Enabled");
    mouseFolder.add(params, "mouseRange", 0.0, 2.0, 0.1).name("Range");

    const [albedoTexture, depthTexture, normalTexture] = await Promise.all([
      Texture.fromURL(engine.device, "/assets/monalisa.jpg"),
      Texture.fromURL(engine.device, "/assets/monalisa-depth-map.png"),
      Texture.fromURL(engine.device, "/assets/monalisa-normal-map.png"),
    ]);

    const scene = new Scene();

    const planeHeight = 2.0;
    const planeWidth = planeHeight * imageAspectRatio;

    const planeGeometry = new PlaneGeometry({
      width: planeWidth,
      height: planeHeight,
      widthSegments: 1,
      heightSegments: 1,
      orientation: "XY",
    });

    const parallaxMaterial = new ParallaxMaterial({
      albedo: albedoTexture,
      depth: depthTexture,
      normal: normalTexture,
      depthScale: params.depthScale,
      normalScale: params.normalScale,
      shininess: params.shininess,
      generateNormalFromDepth: false, // Use provided normal map
    });

    const mesh = new Mesh(planeGeometry, parallaxMaterial);
    scene.add(mesh);

    // Ambient light
    const ambientLight = new AmbientLight(
      new Color(1.0, 1.0, 1.0),
      params.ambientIntensity
    );
    scene.add(ambientLight);

    // Light 1: Main light (mouse controlled)
    const light1 = new PointLight(
      new Color(params.light1ColorR, params.light1ColorG, params.light1ColorB),
      params.light1Intensity,
      20,
      "quadratic"
    );
    light1.position.set(0, 0, params.light1PosZ);
    scene.add(light1);

    // Light 2: Secondary fixed light (warm tone from left-top)
    const light2 = new PointLight(
      new Color(params.light2ColorR, params.light2ColorG, params.light2ColorB),
      params.light2Intensity,
      20,
      "quadratic"
    );
    light2.position.set(
      params.light2PosX,
      params.light2PosY,
      params.light2PosZ
    );
    scene.add(light2);

    const camera = new PerspectiveCamera({
      fov: 45,
      near: 0.1,
      far: 100,
    });
    camera.updateAspect(canvas);

    // Calculate camera distance to fill viewport with the plane
    // For a plane of height H, to fill the viewport vertically:
    // distance = (H / 2) / tan(fov / 2)
    const fovRadians = (45 * Math.PI) / 180;
    const distance = planeHeight / 2 / Math.tan(fovRadians / 2);

    camera.position.set(0, 0, distance);
    camera.lookAt(new Vector3(0, 0, 0));

    let mouseX = 0;
    let mouseY = 0;

    canvas.addEventListener("mousemove", (event) => {
      if (!params.mouseEnabled) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      // Normalize mouse position to [-1, 1] range
      mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    });

    canvas.addEventListener("mouseleave", () => {
      mouseX = 0;
      mouseY = 0;
    });

    engine.run(() => {
      // Update camera aspect ratio if canvas size changed
      camera.updateAspect(canvas);

      // Update parallax material properties
      parallaxMaterial.depthScale = params.depthScale;
      parallaxMaterial.normalScale = params.normalScale;
      parallaxMaterial.shininess = params.shininess;

      // Update ambient light
      ambientLight.intensity = params.ambientIntensity;

      // Update light 1 position based on mouse
      if (params.mouseEnabled) {
        light1.position.set(
          mouseX * params.mouseRange,
          mouseY * params.mouseRange,
          params.light1PosZ
        );
      } else {
        light1.position.set(0, 0, params.light1PosZ);
      }

      // Update light 1 properties
      if (params.light1Enabled) {
        light1.intensity = params.light1Intensity;
        light1.color = new Color(
          params.light1ColorR,
          params.light1ColorG,
          params.light1ColorB
        );
      } else {
        light1.intensity = 0;
      }

      // Update light 2 properties
      light2.position.set(
        params.light2PosX,
        params.light2PosY,
        params.light2PosZ
      );
      if (params.light2Enabled) {
        light2.intensity = params.light2Intensity;
        light2.color = new Color(
          params.light2ColorR,
          params.light2ColorG,
          params.light2ColorB
        );
      } else {
        light2.intensity = 0;
      }

      renderer.render(scene, camera);
    });
  } catch (error) {
    console.error(error);
  }
}

main();
