import { Object3D } from "./Object3D";
import type { Light } from "../light/Light";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";
import type { Texture } from "../texture";
import type { CubeTexture } from "../texture/CubeTexture";
import type { PMREMResult } from "../texture/PMREMGenerator";
import { SkyboxMaterial } from "../material/SkyboxMaterial";

export interface SceneEnvironmentOptions {
  /** Equirectangular HDR/LDR panorama texture */
  equirectangularMap?: Texture;
  /** Pre-filtered specular IBL cubemap (from PMREMGenerator) */
  prefilteredMap?: CubeTexture;
  /** Diffuse irradiance IBL cubemap (from PMREMGenerator) */
  irradianceMap?: CubeTexture;
  /** Environment intensity for IBL reflections (default: 1.0) */
  environmentIntensity?: number;
  /** Skybox exposure for tone mapping (default: 1.0) */
  skyboxExposure?: number;
  /** Skybox roughness for blur effect (default: 0.0) */
  skyboxRoughness?: number;
}

/**
 * Represents a 3D scene graph that contains objects, lights, and environment settings.
 *
 * @example
 * ```ts
 * const scene = new Scene();
 * const mesh = new Mesh(geometry, material);
 * scene.add(mesh);
 *
 * // Setup environment with IBL
 * const pmrem = await PMREMGenerator.fromEquirectangular(device, hdrTexture);
 * scene.setEnvironmentFromPMREM(pmrem, { environmentIntensity: 1.2 });
 * ```
 */
export class Scene extends Object3D {
  private _equirectangularMap?: Texture;
  private _prefilteredMap?: CubeTexture;
  private _irradianceMap?: CubeTexture;
  private _environmentIntensity: number = 1.0;
  private _skyboxExposure: number = 1.0;
  private _skyboxRoughness: number = 0.0;
  private _skyboxMaterial?: SkyboxMaterial;

  /** Equirectangular environment map texture for skybox background. */
  get equirectangularMap(): Texture | undefined {
    return this._equirectangularMap;
  }

  /** Pre-filtered specular IBL cubemap for reflections on PBR materials. */
  get prefilteredMap(): CubeTexture | undefined {
    return this._prefilteredMap;
  }

  /** Diffuse irradiance IBL cubemap for ambient lighting on PBR materials. */
  get irradianceMap(): CubeTexture | undefined {
    return this._irradianceMap;
  }

  /** Environment intensity for IBL reflections (only affects rendering when hasIBL is true). */
  get environmentIntensity(): number {
    return this._environmentIntensity;
  }

  set environmentIntensity(value: number) {
    this._environmentIntensity = value;
  }

  /** Skybox exposure value for HDR tone mapping. */
  get skyboxExposure(): number {
    return this._skyboxExposure;
  }

  set skyboxExposure(value: number) {
    this._skyboxExposure = value;
    if (this._skyboxMaterial) {
      this._skyboxMaterial.setExposure(value);
    }
  }

  /** Skybox roughness for blur effect (0 = sharp, 1 = maximum blur). */
  get skyboxRoughness(): number {
    return this._skyboxRoughness;
  }

  set skyboxRoughness(value: number) {
    this._skyboxRoughness = value;
    if (this._skyboxMaterial) {
      this._skyboxMaterial.setRoughness(value);
    }
  }

  /** Internal skybox material for rendering the environment background (created when environment is set). */
  get skyboxMaterial(): SkyboxMaterial | undefined {
    return this._skyboxMaterial;
  }

  /** Checks if IBL (Image-Based Lighting) is fully configured (both prefilteredMap and irradianceMap are set). */
  get hasIBL(): boolean {
    return !!(this._prefilteredMap && this._irradianceMap);
  }

  private _cleanupSkyboxMaterial(): void {
    if (this._skyboxMaterial) {
      this._skyboxMaterial.dispose();
      this._skyboxMaterial = undefined;
    }
  }

  /**
   * Sets the environment using PMREM-generated IBL maps for full PBR lighting.
   * @param pmrem - Pre-filtered environment maps from PMREMGenerator.fromEquirectangular()
   * @param options - Optional configuration for intensity, exposure, and roughness
   * @example
   * ```ts
   * const pmrem = await PMREMGenerator.fromEquirectangular(device, hdrTexture);
   * scene.setEnvironmentFromPMREM(pmrem, { environmentIntensity: 1.0 });
   * ```
   */
  setEnvironmentFromPMREM(
    pmrem: PMREMResult,
    options?: Partial<SceneEnvironmentOptions>,
  ): void {
    if (!pmrem?.prefilteredMap || !pmrem?.irradianceMap) {
      throw new Error(
        "Scene.setEnvironmentFromPMREM() requires pmrem.prefilteredMap and pmrem.irradianceMap",
      );
    }

    // Clean up existing skybox material to prevent memory leaks
    this._cleanupSkyboxMaterial();

    this._prefilteredMap = pmrem.prefilteredMap;
    this._irradianceMap = pmrem.irradianceMap;

    if (options?.environmentIntensity !== undefined) {
      this._environmentIntensity = options.environmentIntensity;
    }
    if (options?.skyboxExposure !== undefined) {
      this._skyboxExposure = options.skyboxExposure;
    }
    if (options?.skyboxRoughness !== undefined) {
      this._skyboxRoughness = options.skyboxRoughness;
    }

    // Create skybox material using the prefiltered cubemap
    this._skyboxMaterial = new SkyboxMaterial({
      cubeMap: pmrem.prefilteredMap,
      exposure: this._skyboxExposure,
      roughness: this._skyboxRoughness,
    });
  }

  /**
   * Sets the environment using an equirectangular panorama texture for skybox only (no IBL reflections).
   * @param texture - Equirectangular panorama texture (2:1 aspect ratio)
   * @param options - Optional configuration for exposure and roughness
   * @example
   * ```ts
   * const hdrTexture = await HDRLoader.load(device, 'panorama.hdr');
   * scene.setEnvironmentFromEquirectangular(hdrTexture, { skyboxExposure: 1.2 });
   * ```
   */
  setEnvironmentFromEquirectangular(
    texture: Texture,
    options?: Partial<SceneEnvironmentOptions>,
  ): void {
    // Clean up existing skybox material to prevent memory leaks
    this._cleanupSkyboxMaterial();

    this._equirectangularMap = texture;
    this._prefilteredMap = undefined;
    this._irradianceMap = undefined;

    if (options?.skyboxExposure !== undefined) {
      this._skyboxExposure = options.skyboxExposure;
    }
    if (options?.skyboxRoughness !== undefined) {
      this._skyboxRoughness = options.skyboxRoughness;
    }

    // Create skybox material using equirectangular map
    this._skyboxMaterial = new SkyboxMaterial({
      equirectangularMap: texture,
      exposure: this._skyboxExposure,
      roughness: this._skyboxRoughness,
    });
  }

  /**
   * Sets the full environment configuration with manual control over all maps.
   * @param options - Complete environment configuration including maps and parameters
   */
  setEnvironment(options: SceneEnvironmentOptions): void {
    // Clean up existing skybox material to prevent memory leaks
    this._cleanupSkyboxMaterial();

    this._equirectangularMap = options.equirectangularMap;
    this._prefilteredMap = options.prefilteredMap;
    this._irradianceMap = options.irradianceMap;

    if (options.environmentIntensity !== undefined) {
      this._environmentIntensity = options.environmentIntensity;
    }
    if (options.skyboxExposure !== undefined) {
      this._skyboxExposure = options.skyboxExposure;
    }
    if (options.skyboxRoughness !== undefined) {
      this._skyboxRoughness = options.skyboxRoughness;
    }

    // Create skybox material based on available textures
    if (options.prefilteredMap) {
      this._skyboxMaterial = new SkyboxMaterial({
        cubeMap: options.prefilteredMap,
        exposure: this._skyboxExposure,
        roughness: this._skyboxRoughness,
      });
    } else if (options.equirectangularMap) {
      this._skyboxMaterial = new SkyboxMaterial({
        equirectangularMap: options.equirectangularMap,
        exposure: this._skyboxExposure,
        roughness: this._skyboxRoughness,
      });
    }
  }

  /**
   * Clears all environment settings including skybox and IBL maps.
   */
  clearEnvironment(): void {
    // Clean up skybox material
    this._cleanupSkyboxMaterial();

    // Dispose and clear skybox material (owned by Scene), and clear texture references (borrowed resources, not owned by Scene)
    this._equirectangularMap = undefined;
    this._prefilteredMap = undefined;
    this._irradianceMap = undefined;
  }

  /**
   * Disposes all resources owned by this scene (skybox material only, not textures or children).
   * @example
   * ```ts
   * engine.stop();
   * scene.dispose();
   * ```
   */
  dispose(): void {
    this.clearEnvironment();
  }

  /**
   * Updates the world transformation matrices for this scene and all children.
   */
  updateMatrixWorld(): void {
    this.updateWorldMatrix(false, true);
  }

  /**
   * Finds the first light of the specified type in the scene graph.
   * @param type - Optional light constructor to filter by
   * @returns The first matching light, or undefined if not found
   */
  findFirstLight<T extends Light = Light>(
    type?: new (...args: any[]) => T,
  ): T | undefined {
    let light: T | undefined;
    this.traverse((obj) => {
      if (
        !light &&
        (obj instanceof DirectionalLight || obj instanceof PointLight)
      ) {
        if (!type || obj instanceof type) {
          light = obj as unknown as T;
        }
      }
    });
    return light;
  }
}
