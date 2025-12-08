import {
  Engine,
  Renderer,
  BoxGeometry,
  BlinnPhongMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
  DirectionalLight,
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
  // Geometry params
  width: number;
  height: number;
  depth: number;
  widthSegments: number;
  heightSegments: number;
  depthSegments: number;
  // Material params
  shininess: number;
  wireframe: boolean;
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
      autoRotate: true,
      rotationSpeed: 1.0,
      scale: 1.0,
      fov: 60,
      // Geometry params
      width: 2,
      height: 2,
      depth: 2,
      widthSegments: 2,
      heightSegments: 2,
      depthSegments: 2,
      // Material params
      shininess: 32,
      wireframe: false,
    };

    const gui = new GUI({ title: "Box Geometry Controls" });

    const geometryFolder = gui.addFolder("Geometry");
    geometryFolder
      .add(params, "width", 0.1, 5)
      .name("Width")
      .onChange(() => {
        needsGeometryUpdate = true;
      });
    geometryFolder
      .add(params, "height", 0.1, 5)
      .name("Height")
      .onChange(() => {
        needsGeometryUpdate = true;
      });
    geometryFolder
      .add(params, "depth", 0.1, 5)
      .name("Depth")
      .onChange(() => {
        needsGeometryUpdate = true;
      });
    geometryFolder
      .add(params, "widthSegments", 1, 10, 1)
      .name("Width Segments")
      .onChange(() => {
        needsGeometryUpdate = true;
      });
    geometryFolder
      .add(params, "heightSegments", 1, 10, 1)
      .name("Height Segments")
      .onChange(() => {
        needsGeometryUpdate = true;
      });
    geometryFolder
      .add(params, "depthSegments", 1, 10, 1)
      .name("Depth Segments")
      .onChange(() => {
        needsGeometryUpdate = true;
      });
    geometryFolder.open();

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
    materialFolder.add(params, "wireframe").name("Wireframe");

    const scene = new Scene();
    let geometry = new BoxGeometry(
      params.width,
      params.height,
      params.depth,
      params.widthSegments,
      params.heightSegments,
      params.depthSegments
    );
    let needsGeometryUpdate = false;
    const material = new BlinnPhongMaterial({
      color: [0.8, 0.2, 0.2],
      shininess: params.shininess,
    });
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    // Add directional light
    const light = new DirectionalLight(
      new Vector3(1, -1, 0.5),
      new Color(1, 1, 1),
      1.0
    );
    light.position.set(3, 3, 3);
    scene.add(light);

    const camera = new PerspectiveCamera({
      fov: 60,
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
      // Update geometry if parameters changed
      if (needsGeometryUpdate) {
        geometry = new BoxGeometry(
          params.width,
          params.height,
          params.depth,
          params.widthSegments,
          params.heightSegments,
          params.depthSegments
        );
        mesh.geometry = geometry;
        needsGeometryUpdate = false;
      }

      // Update mesh transform from params
      if (params.autoRotate) {
        params.rotationX += deltaTime * params.rotationSpeed * 0.5;
        params.rotationY += deltaTime * params.rotationSpeed;
      }

      mesh.rotation.set(params.rotationX, params.rotationY, params.rotationZ);
      mesh.scale.set(params.scale, params.scale, params.scale);

      // Update material from params
      material.setShininess(params.shininess);
      material.wireframe = params.wireframe;

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
