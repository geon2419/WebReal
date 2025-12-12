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

export class Scene extends Object3D {
  private _equirectangularMap?: Texture;
  private _prefilteredMap?: CubeTexture;
  private _irradianceMap?: CubeTexture;
  private _environmentIntensity: number = 1.0;
  private _skyboxExposure: number = 1.0;
  private _skyboxRoughness: number = 0.0;
  private _skyboxMaterial?: SkyboxMaterial;

  /**
   * The equirectangular environment map texture.
   */
  get equirectangularMap(): Texture | undefined {
    return this._equirectangularMap;
  }

  /**
   * The pre-filtered specular IBL cubemap.
   */
  get prefilteredMap(): CubeTexture | undefined {
    return this._prefilteredMap;
  }

  /**
   * The diffuse irradiance IBL cubemap.
   */
  get irradianceMap(): CubeTexture | undefined {
    return this._irradianceMap;
  }

  /**
   * Environment intensity for IBL reflections on PBR materials.
   *
   * @remarks
   * This only has an effect when IBL is configured (i.e. both `prefilteredMap` and
   * `irradianceMap` are set / `hasIBL === true`). If you call
   * `setEnvironmentFromEquirectangular()`, IBL maps are cleared and this value will
   * not affect rendering until IBL is set again (e.g. via `setEnvironmentFromPMREM()`).
   */
  get environmentIntensity(): number {
    return this._environmentIntensity;
  }

  set environmentIntensity(value: number) {
    this._environmentIntensity = value;
  }

  /**
   * Skybox exposure for HDR tone mapping.
   */
  get skyboxExposure(): number {
    return this._skyboxExposure;
  }

  set skyboxExposure(value: number) {
    this._skyboxExposure = value;
    if (this._skyboxMaterial) {
      this._skyboxMaterial.setExposure(value);
    }
  }

  /**
   * Skybox roughness for blur effect (0 = sharp, 1 = maximum blur).
   */
  get skyboxRoughness(): number {
    return this._skyboxRoughness;
  }

  set skyboxRoughness(value: number) {
    this._skyboxRoughness = value;
    if (this._skyboxMaterial) {
      this._skyboxMaterial.setRoughness(value);
    }
  }

  /**
   * The internal skybox material used for rendering the environment background.
   * Automatically created when environment is set.
   */
  get skyboxMaterial(): SkyboxMaterial | undefined {
    return this._skyboxMaterial;
  }

  /**
   * Returns true if the scene has IBL (prefilteredMap and irradianceMap) configured.
   */
  get hasIBL(): boolean {
    return !!(this._prefilteredMap && this._irradianceMap);
  }

  /**
   * Sets the environment for the scene using PMREM result from PMREMGenerator.
   * This is the recommended way to set up environment with full IBL support.
   *
   * @param pmrem - Result from PMREMGenerator.fromEquirectangular()
   * @param options - Additional options for environment setup
   * @throws {Error} If pmrem is missing prefilteredMap or irradianceMap
   *
   * @example
   * ```ts
   * const hdrTexture = await HDRLoader.load(device, 'environment.hdr');
   * const pmrem = await PMREMGenerator.fromEquirectangular(device, hdrTexture);
   * scene.setEnvironmentFromPMREM(pmrem, {
   *   environmentIntensity: 1.0,
   *   skyboxExposure: 1.5
   * });
   * ```
   */
  setEnvironmentFromPMREM(
    pmrem: PMREMResult,
    options?: Partial<SceneEnvironmentOptions>
  ): void {
    if (!pmrem?.prefilteredMap || !pmrem?.irradianceMap) {
      throw new Error(
        "Scene.setEnvironmentFromPMREM() requires pmrem.prefilteredMap and pmrem.irradianceMap"
      );
    }

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
   * Sets the environment using an equirectangular panorama texture.
   *
   * @remarks
   * This method is for skybox background only and does not provide IBL reflections.
   * It clears the IBL maps (`prefilteredMap` and `irradianceMap`), so
   * `environmentIntensity` will not have any effect until IBL is set again.
   * Use `setEnvironmentFromPMREM()` for full IBL support.
   *
   * @param texture - Equirectangular panorama texture (2:1 aspect ratio)
   * @param options - Additional options for environment setup
   *
   * @example
   * ```ts
   * const hdrTexture = await HDRLoader.load(device, 'panorama.hdr');
   * scene.setEnvironmentFromEquirectangular(hdrTexture, {
   *   skyboxExposure: 1.2
   * });
   * ```
   */
  setEnvironmentFromEquirectangular(
    texture: Texture,
    options?: Partial<SceneEnvironmentOptions>
  ): void {
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
   * Sets the full environment configuration with manual control.
   *
   * @param options - Environment configuration options
   */
  setEnvironment(options: SceneEnvironmentOptions): void {
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
   * Clears the environment settings.
   */
  clearEnvironment(): void {
    this._equirectangularMap = undefined;
    this._prefilteredMap = undefined;
    this._irradianceMap = undefined;
    this._skyboxMaterial = undefined;
  }

  updateMatrixWorld(): void {
    this.updateWorldMatrix(false, true);
  }

  /**
   * Finds the first light of the specified type in the scene.
   * @param type - Optional light constructor to filter by type
   * @returns The first matching light found, or undefined if none exists
   */
  findFirstLight<T extends Light = Light>(
    type?: new (...args: any[]) => T
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
