import {
  Engine,
  Renderer,
  BoxGeometry,
  BlinnPhongMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
  PointLight,
  PointLightHelper,
  OrbitCameraController,
} from "@web-real/core";
import { Color } from "@web-real/math";
import GUI from "lil-gui";

interface CubeParams {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  autoRotate: boolean;
  rotationSpeed: number;
  scale: number;
  fov: number;
  // Material params
  shininess: number;
  // Light params
  lightPosX: number;
  lightPosY: number;
  lightPosZ: number;
  lightIntensity: number;
  lightRange: number;
  attenuationType: "linear" | "quadratic" | "physical";
}

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  try {
    const engine = await Engine.create({ canvas });
    const renderer = new Renderer(engine);
    renderer.setClearColor([0.1, 0.1, 0.1]);

    const params: CubeParams = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      autoRotate: false,
      rotationSpeed: 1.0,
      scale: 1.0,
      fov: 60,
      // Material params
      shininess: 32,
      // Light params
      lightPosX: 3,
      lightPosY: 3,
      lightPosZ: 3,
      lightIntensity: 1.0,
      lightRange: 10,
      attenuationType: "quadratic",
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

    const materialFolder = gui.addFolder("Material");
    materialFolder.add(params, "shininess", 1, 256).name("Shininess");

    const cameraFolder = gui.addFolder("Camera");
    cameraFolder.add(params, "fov", 30, 120).name("FOV");

    const lightFolder = gui.addFolder("Point Light");
    lightFolder.add(params, "lightPosX", -10, 10).name("Position X");
    lightFolder.add(params, "lightPosY", -10, 10).name("Position Y");
    lightFolder.add(params, "lightPosZ", -10, 10).name("Position Z");
    lightFolder.add(params, "lightIntensity", 0, 3).name("Intensity");
    lightFolder.add(params, "lightRange", 1, 30).name("Range");
    lightFolder
      .add(params, "attenuationType", ["linear", "quadratic", "physical"])
      .name("Attenuation");

    const scene = new Scene();
    const geometry = new BoxGeometry(2, 2, 2);
    const material = new BlinnPhongMaterial({
      color: [0.8, 0.2, 0.2],
      shininess: params.shininess,
    });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    // Add point light
    const light = new PointLight(
      new Color(1, 1, 1),
      params.lightIntensity,
      params.lightRange,
      params.attenuationType
    );
    light.position.set(params.lightPosX, params.lightPosY, params.lightPosZ);
    scene.add(light);

    // Add point light helper
    const lightHelper = new PointLightHelper(light);
    scene.add(lightHelper);

    const camera = new PerspectiveCamera({
      fov: params.fov,
      near: 0.1,
      far: 100,
    });
    camera.updateAspect(canvas);

    const orbitController = new OrbitCameraController(camera, canvas, {
      radius: 5,
      theta: 0,
      phi: Math.PI / 3,
    });

    engine.run((deltaTime: number) => {
      // Update mesh transform from params
      if (params.autoRotate) {
        params.rotationX += deltaTime * params.rotationSpeed * 0.5;
        params.rotationY += deltaTime * params.rotationSpeed;
      }

      mesh.rotation.set(params.rotationX, params.rotationY, params.rotationZ);
      mesh.scale.set(params.scale, params.scale, params.scale);

      // Update material from params
      material.setShininess(params.shininess);

      // Update camera FOV
      camera.fov = params.fov;

      // Update light from params
      light.position.set(params.lightPosX, params.lightPosY, params.lightPosZ);
      light.intensity = params.lightIntensity;
      light.range = params.lightRange;
      light.attenuationType = params.attenuationType;

      // Update light helper
      lightHelper.update();

      // Render scene
      renderer.render(scene, camera);
    });

    window.addEventListener("beforeunload", () => {
      orbitController.dispose();
      camera.dispose();
      gui.destroy();
      renderer.dispose();
      engine.dispose();
    });
  } catch (error) {
    console.error(error);
  }
}

main();
