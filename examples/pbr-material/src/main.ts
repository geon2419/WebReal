import {
  Engine,
  Renderer,
  SphereGeometry,
  PBRMaterial,
  Mesh,
  Scene,
  PerspectiveCamera,
  PointLight,
  PointLightHelper,
  AmbientLight,
  OrbitCameraController,
} from "@web-real/core";
import { Color } from "@web-real/math";
import GUI from "lil-gui";

interface PBRParams {
  // Material params
  metalness: number;
  roughness: number;
  colorR: number;
  colorG: number;
  colorB: number;
  // Emissive
  emissiveR: number;
  emissiveG: number;
  emissiveB: number;
  emissiveIntensity: number;
  // Light 1 params
  light1PosX: number;
  light1PosY: number;
  light1PosZ: number;
  light1Intensity: number;
  light1Range: number;
  light1ColorR: number;
  light1ColorG: number;
  light1ColorB: number;
  // Light 2 params
  light2Enabled: boolean;
  light2PosX: number;
  light2PosY: number;
  light2PosZ: number;
  light2Intensity: number;
  light2Range: number;
  light2ColorR: number;
  light2ColorG: number;
  light2ColorB: number;
  // Ambient light
  ambientIntensity: number;
  ambientColorR: number;
  ambientColorG: number;
  ambientColorB: number;
  // Camera
  fov: number;
  // Scene
  showGrid: boolean;
  autoRotate: boolean;
}

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  // Handle high DPI displays
  function updateCanvasSize() {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    const width = Math.floor(displayWidth * dpr);
    const height = Math.floor(displayHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  updateCanvasSize();
  window.addEventListener("resize", updateCanvasSize);

  try {
    const engine = await Engine.create({ canvas });
    const renderer = new Renderer(engine);
    renderer.setClearColor([0.05, 0.05, 0.08]);

    const params: PBRParams = {
      // Material params
      metalness: 0.0,
      roughness: 0.4,
      colorR: 0.8,
      colorG: 0.2,
      colorB: 0.2,
      // Emissive
      emissiveR: 0.0,
      emissiveG: 0.0,
      emissiveB: 0.0,
      emissiveIntensity: 1.0,
      // Light 1 params
      light1PosX: 5,
      light1PosY: 5,
      light1PosZ: 5,
      light1Intensity: 1.5,
      light1Range: 20,
      light1ColorR: 1.0,
      light1ColorG: 0.95,
      light1ColorB: 0.9,
      // Light 2 params
      light2Enabled: true,
      light2PosX: -5,
      light2PosY: 3,
      light2PosZ: -3,
      light2Intensity: 0.8,
      light2Range: 15,
      light2ColorR: 0.6,
      light2ColorG: 0.7,
      light2ColorB: 1.0,
      // Ambient light
      ambientIntensity: 0.05,
      ambientColorR: 1.0,
      ambientColorG: 1.0,
      ambientColorB: 1.0,
      // Camera
      fov: 50,
      // Scene
      showGrid: true,
      autoRotate: true,
    };

    const gui = new GUI({ title: "PBR Material Controls" });

    // Material folder
    const materialFolder = gui.addFolder("Material");
    materialFolder.add(params, "metalness", 0, 1, 0.01).name("Metalness");
    materialFolder.add(params, "roughness", 0, 1, 0.01).name("Roughness");

    const colorFolder = materialFolder.addFolder("Color");
    colorFolder.add(params, "colorR", 0, 1, 0.01).name("Red");
    colorFolder.add(params, "colorG", 0, 1, 0.01).name("Green");
    colorFolder.add(params, "colorB", 0, 1, 0.01).name("Blue");

    const emissiveFolder = materialFolder.addFolder("Emissive");
    emissiveFolder.add(params, "emissiveR", 0, 1, 0.01).name("Red");
    emissiveFolder.add(params, "emissiveG", 0, 1, 0.01).name("Green");
    emissiveFolder.add(params, "emissiveB", 0, 1, 0.01).name("Blue");
    emissiveFolder
      .add(params, "emissiveIntensity", 0, 5, 0.1)
      .name("Intensity");

    // Light 1 folder
    const light1Folder = gui.addFolder("Light 1 (Warm)");
    light1Folder.add(params, "light1PosX", -10, 10).name("Position X");
    light1Folder.add(params, "light1PosY", -10, 10).name("Position Y");
    light1Folder.add(params, "light1PosZ", -10, 10).name("Position Z");
    light1Folder.add(params, "light1Intensity", 0, 5, 0.1).name("Intensity");
    light1Folder.add(params, "light1Range", 1, 30).name("Range");
    const light1ColorFolder = light1Folder.addFolder("Color");
    light1ColorFolder.add(params, "light1ColorR", 0, 1, 0.01).name("Red");
    light1ColorFolder.add(params, "light1ColorG", 0, 1, 0.01).name("Green");
    light1ColorFolder.add(params, "light1ColorB", 0, 1, 0.01).name("Blue");

    // Light 2 folder
    const light2Folder = gui.addFolder("Light 2 (Cool)");
    light2Folder.add(params, "light2Enabled").name("Enabled");
    light2Folder.add(params, "light2PosX", -10, 10).name("Position X");
    light2Folder.add(params, "light2PosY", -10, 10).name("Position Y");
    light2Folder.add(params, "light2PosZ", -10, 10).name("Position Z");
    light2Folder.add(params, "light2Intensity", 0, 5, 0.1).name("Intensity");
    light2Folder.add(params, "light2Range", 1, 30).name("Range");
    const light2ColorFolder = light2Folder.addFolder("Color");
    light2ColorFolder.add(params, "light2ColorR", 0, 1, 0.01).name("Red");
    light2ColorFolder.add(params, "light2ColorG", 0, 1, 0.01).name("Green");
    light2ColorFolder.add(params, "light2ColorB", 0, 1, 0.01).name("Blue");

    // Ambient folder
    const ambientFolder = gui.addFolder("Ambient Light");
    ambientFolder
      .add(params, "ambientIntensity", 0, 0.5, 0.01)
      .name("Intensity");
    const ambientColorFolder = ambientFolder.addFolder("Color");
    ambientColorFolder.add(params, "ambientColorR", 0, 1, 0.01).name("Red");
    ambientColorFolder.add(params, "ambientColorG", 0, 1, 0.01).name("Green");
    ambientColorFolder.add(params, "ambientColorB", 0, 1, 0.01).name("Blue");

    // Camera folder
    const cameraFolder = gui.addFolder("Camera");
    cameraFolder.add(params, "fov", 30, 90).name("FOV");

    // Scene folder
    const sceneFolder = gui.addFolder("Scene");
    sceneFolder.add(params, "autoRotate").name("Auto Rotate");

    const scene = new Scene();

    // Create sphere grid showing different metalness/roughness combinations
    const sphereGeometry = new SphereGeometry({
      radius: 0.8,
      widthSegments: 48,
      heightSegments: 32,
    });
    const gridSize = 5;
    const spacing = 2.2;
    const spheres: {
      mesh: Mesh;
      material: PBRMaterial;
      baseMetalness: number;
      baseRoughness: number;
    }[] = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const metalness = col / (gridSize - 1);
        const roughness = row / (gridSize - 1);

        const material = new PBRMaterial({
          color: [params.colorR, params.colorG, params.colorB],
          metalness,
          roughness,
        });

        const mesh = new Mesh(sphereGeometry, material);
        mesh.position.set(
          (col - (gridSize - 1) / 2) * spacing,
          ((gridSize - 1) / 2 - row) * spacing,
          0
        );

        scene.add(mesh);
        spheres.push({
          mesh,
          material,
          baseMetalness: metalness,
          baseRoughness: roughness,
        });
      }
    }

    // Add ambient light
    const ambientLight = new AmbientLight(
      new Color(
        params.ambientColorR,
        params.ambientColorG,
        params.ambientColorB
      ),
      params.ambientIntensity
    );
    scene.add(ambientLight);

    // Add point light 1 (warm)
    const light1 = new PointLight(
      new Color(params.light1ColorR, params.light1ColorG, params.light1ColorB),
      params.light1Intensity,
      params.light1Range,
      "quadratic"
    );
    light1.position.set(
      params.light1PosX,
      params.light1PosY,
      params.light1PosZ
    );
    scene.add(light1);

    // Add point light helper 1
    const lightHelper1 = new PointLightHelper(light1);
    scene.add(lightHelper1);

    // Add point light 2 (cool)
    const light2 = new PointLight(
      new Color(params.light2ColorR, params.light2ColorG, params.light2ColorB),
      params.light2Intensity,
      params.light2Range,
      "quadratic"
    );
    light2.position.set(
      params.light2PosX,
      params.light2PosY,
      params.light2PosZ
    );
    scene.add(light2);

    // Add point light helper 2
    const lightHelper2 = new PointLightHelper(light2);
    scene.add(lightHelper2);

    const camera = new PerspectiveCamera({
      fov: params.fov,
      near: 0.1,
      far: 100,
    });
    camera.updateAspect(canvas);

    const orbitController = new OrbitCameraController(camera, canvas, {
      radius: 12,
      theta: Math.PI / 6,
      phi: Math.PI / 3,
    });

    let time = 0;

    engine.run((deltaTime: number) => {
      time += deltaTime;

      // Auto rotate scene
      if (params.autoRotate) {
        orbitController.theta += deltaTime * 0.2;
      }

      // Update all sphere materials
      for (const { material } of spheres) {
        material.setColor([params.colorR, params.colorG, params.colorB]);
        material.setEmissive([
          params.emissiveR,
          params.emissiveG,
          params.emissiveB,
        ]);
        material.setEmissiveIntensity(params.emissiveIntensity);
      }

      // Update light 1
      light1.position.set(
        params.light1PosX,
        params.light1PosY,
        params.light1PosZ
      );
      light1.intensity = params.light1Intensity;
      light1.range = params.light1Range;
      light1.color = new Color(
        params.light1ColorR,
        params.light1ColorG,
        params.light1ColorB
      );

      // Update light 2
      if (params.light2Enabled) {
        light2.position.set(
          params.light2PosX,
          params.light2PosY,
          params.light2PosZ
        );
        light2.intensity = params.light2Intensity;
        light2.range = params.light2Range;
        light2.color = new Color(
          params.light2ColorR,
          params.light2ColorG,
          params.light2ColorB
        );
        lightHelper2.visible = true;
      } else {
        light2.intensity = 0;
        lightHelper2.visible = false;
      }

      // Update ambient light
      ambientLight.intensity = params.ambientIntensity;
      ambientLight.color = new Color(
        params.ambientColorR,
        params.ambientColorG,
        params.ambientColorB
      );

      // Update camera
      camera.fov = params.fov;

      orbitController.update();
      renderer.render(scene, camera);
    });
  } catch (error) {
    console.error("WebGPU initialization failed:", error);
    const container = document.getElementById("canvas-container");
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <h2>WebGPU Not Supported</h2>
          <p>Please use a browser that supports WebGPU (Chrome 113+, Edge 113+).</p>
          <p style="color: #ff6b6b; margin-top: 10px;">${error}</p>
        </div>
      `;
    }
  }
}

main();
