import {
  Engine,
  Renderer,
  BoxGeometry,
  BlinnPhongMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
  DirectionalLight,
  DirectionalLightHelper,
  OrbitCameraController,
} from "@web-real/core";
import { Color, Vector3 } from "@web-real/math";
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
  lightDirX: number;
  lightDirY: number;
  lightDirZ: number;
  lightIntensity: number;
  showLightHelper: boolean;
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
      lightDirX: 1,
      lightDirY: -1,
      lightDirZ: 0.5,
      lightIntensity: 1.0,
      showLightHelper: true,
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

    const lightFolder = gui.addFolder("Directional Light");
    lightFolder.add(params, "lightPosX", -5, 5).name("Position X");
    lightFolder.add(params, "lightPosY", -5, 5).name("Position Y");
    lightFolder.add(params, "lightPosZ", -5, 5).name("Position Z");
    lightFolder.add(params, "lightDirX", -2, 2).name("Direction X");
    lightFolder.add(params, "lightDirY", -2, 2).name("Direction Y");
    lightFolder.add(params, "lightDirZ", -2, 2).name("Direction Z");
    lightFolder.add(params, "lightIntensity", 0, 2).name("Intensity");
    lightFolder.add(params, "showLightHelper").name("Show Helper");

    const scene = new Scene();
    const geometry = new BoxGeometry(2, 2, 2);
    const material = new BlinnPhongMaterial({
      color: [0.8, 0.2, 0.2],
      shininess: params.shininess,
    });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    // Add directional light
    const light = new DirectionalLight(
      new Vector3(params.lightDirX, params.lightDirY, params.lightDirZ),
      new Color(1, 1, 1),
      params.lightIntensity
    );
    light.position.set(params.lightPosX, params.lightPosY, params.lightPosZ);
    scene.add(light);

    // Add light helper for debugging
    const lightHelper = new DirectionalLightHelper(light, {
      size: 2,
      color: Color.YELLOW,
    });
    scene.add(lightHelper);

    const camera = new PerspectiveCamera({
      fov: params.fov,
      near: 0.1,
      far: 100,
    });
    camera.updateAspect(canvas);

    // OrbitCameraController로 카메라 제어
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
      material.shininess = params.shininess;

      // Update camera FOV
      camera.fov = params.fov;

      // Update light from params
      light.position.set(params.lightPosX, params.lightPosY, params.lightPosZ);
      light.direction = new Vector3(
        params.lightDirX,
        params.lightDirY,
        params.lightDirZ
      ).normalize();
      light.intensity = params.lightIntensity;

      // Update light helper
      lightHelper.update();
      lightHelper.visible = params.showLightHelper;

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
