import {
  Engine,
  Renderer,
  PlaneGeometry,
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

interface PlaneParams {
  // Plane dimensions
  width: number;
  height: number;
  widthSegments: number;
  heightSegments: number;
  // Material params
  shininess: number;
  // Light params
  lightDirX: number;
  lightDirY: number;
  lightDirZ: number;
  lightIntensity: number;
  showLightHelper: boolean;
  // Visibility
  showXY: boolean;
  showXZ: boolean;
  showYZ: boolean;
}

// Store meshes for dynamic updates
let meshXY: Mesh | null = null;
let meshXZ: Mesh | null = null;
let meshYZ: Mesh | null = null;

function createPlaneMeshes(
  scene: Scene,
  params: PlaneParams,
  materials: {
    materialXY: BlinnPhongMaterial;
    materialXZ: BlinnPhongMaterial;
    materialYZ: BlinnPhongMaterial;
  }
) {
  // Remove existing meshes
  if (meshXY) scene.remove(meshXY);
  if (meshXZ) scene.remove(meshXZ);
  if (meshYZ) scene.remove(meshYZ);

  const { width, height, widthSegments, heightSegments } = params;
  const { materialXY, materialXZ, materialYZ } = materials;

  // XY plane (wall facing +Z) - Red color
  const geometryXY = new PlaneGeometry({
    width,
    height,
    widthSegments,
    heightSegments,
    orientation: "XY",
  });
  meshXY = new Mesh(geometryXY, materialXY);
  meshXY.position.set(0, 0, -2);
  meshXY.visible = params.showXY;
  scene.add(meshXY);

  // XZ plane (floor facing +Y) - Green color
  const geometryXZ = new PlaneGeometry({
    width,
    height,
    widthSegments,
    heightSegments,
    orientation: "XZ",
  });
  meshXZ = new Mesh(geometryXZ, materialXZ);
  meshXZ.position.set(0, -2, 0);
  meshXZ.visible = params.showXZ;
  scene.add(meshXZ);

  // YZ plane (side wall facing +X) - Blue color
  const geometryYZ = new PlaneGeometry({
    width,
    height,
    widthSegments,
    heightSegments,
    orientation: "YZ",
  });
  meshYZ = new Mesh(geometryYZ, materialYZ);
  meshYZ.position.set(-2, 0, 0);
  meshYZ.visible = params.showYZ;
  scene.add(meshYZ);
}

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  try {
    const engine = await Engine.create({ canvas });
    const renderer = new Renderer(engine);
    renderer.setClearColor([0.1, 0.1, 0.1]);

    const params: PlaneParams = {
      // Plane dimensions
      width: 3,
      height: 3,
      widthSegments: 1,
      heightSegments: 1,
      // Material params
      shininess: 32,
      // Light params
      lightDirX: 1,
      lightDirY: -1,
      lightDirZ: 1,
      lightIntensity: 1.0,
      showLightHelper: true,
      // Visibility
      showXY: true,
      showXZ: true,
      showYZ: true,
    };

    const scene = new Scene();

    // Create materials for each plane
    const materialXY = new BlinnPhongMaterial({
      color: [0.9, 0.3, 0.3], // Red
      shininess: params.shininess,
    });
    const materialXZ = new BlinnPhongMaterial({
      color: [0.3, 0.9, 0.3], // Green
      shininess: params.shininess,
    });
    const materialYZ = new BlinnPhongMaterial({
      color: [0.3, 0.3, 0.9], // Blue
      shininess: params.shininess,
    });

    const materials = { materialXY, materialXZ, materialYZ };

    // Create initial plane meshes
    createPlaneMeshes(scene, params, materials);

    // Add directional light
    const light = new DirectionalLight(
      new Vector3(params.lightDirX, params.lightDirY, params.lightDirZ),
      new Color(1, 1, 1),
      params.lightIntensity
    );
    light.position.set(3, 3, 3);
    scene.add(light);

    // Add light helper
    const lightHelper = new DirectionalLightHelper(light, {
      size: 2,
      color: Color.YELLOW,
    });
    scene.add(lightHelper);

    // Setup camera
    const camera = new PerspectiveCamera({
      fov: 60,
      near: 0.1,
      far: 100,
    });
    camera.updateAspect(canvas);

    const orbitController = new OrbitCameraController(camera, canvas, {
      radius: 8,
      theta: Math.PI / 4,
      phi: Math.PI / 3,
    });

    // Setup GUI
    const gui = new GUI({ title: "PlaneGeometry Controls" });

    const planeFolder = gui.addFolder("Plane Dimensions");
    planeFolder
      .add(params, "width", 1, 10, 0.5)
      .name("Width")
      .onChange(() => createPlaneMeshes(scene, params, materials));
    planeFolder
      .add(params, "height", 1, 10, 0.5)
      .name("Height")
      .onChange(() => createPlaneMeshes(scene, params, materials));
    planeFolder
      .add(params, "widthSegments", 1, 10, 1)
      .name("Width Segments")
      .onChange(() => createPlaneMeshes(scene, params, materials));
    planeFolder
      .add(params, "heightSegments", 1, 10, 1)
      .name("Height Segments")
      .onChange(() => createPlaneMeshes(scene, params, materials));

    const visibilityFolder = gui.addFolder("Visibility");
    visibilityFolder
      .add(params, "showXY")
      .name("XY Plane (Red)")
      .onChange((v: boolean) => {
        if (meshXY) meshXY.visible = v;
      });
    visibilityFolder
      .add(params, "showXZ")
      .name("XZ Plane (Green)")
      .onChange((v: boolean) => {
        if (meshXZ) meshXZ.visible = v;
      });
    visibilityFolder
      .add(params, "showYZ")
      .name("YZ Plane (Blue)")
      .onChange((v: boolean) => {
        if (meshYZ) meshYZ.visible = v;
      });

    const materialFolder = gui.addFolder("Material");
    materialFolder
      .add(params, "shininess", 1, 256)
      .name("Shininess")
      .onChange((v: number) => {
        materialXY.shininess = v;
        materialXZ.shininess = v;
        materialYZ.shininess = v;
      });

    const lightFolder = gui.addFolder("Directional Light");
    lightFolder.add(params, "lightDirX", -2, 2).name("Direction X");
    lightFolder.add(params, "lightDirY", -2, 2).name("Direction Y");
    lightFolder.add(params, "lightDirZ", -2, 2).name("Direction Z");
    lightFolder.add(params, "lightIntensity", 0, 2).name("Intensity");
    lightFolder.add(params, "showLightHelper").name("Show Helper");

    // Render loop
    engine.run(() => {
      // Update light
      light.direction = new Vector3(
        params.lightDirX,
        params.lightDirY,
        params.lightDirZ
      ).normalize();
      light.intensity = params.lightIntensity;

      // Update light helper
      lightHelper.update();
      lightHelper.visible = params.showLightHelper;

      // Render
      renderer.render(scene, camera);
    });

    // Cleanup
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
