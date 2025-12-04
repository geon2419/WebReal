import {
  Engine,
  Renderer,
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
    const renderer = new Renderer(engine);
    renderer.setClearColor(0.1, 0.1, 0.1);

    const params: CubeParams = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      autoRotate: false,
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

      // Render scene
      renderer.render(scene, camera);
    });

    window.addEventListener("beforeunload", () => {
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
