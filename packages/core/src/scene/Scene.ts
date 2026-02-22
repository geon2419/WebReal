import { Object3D } from "./Object3D";
import type { Light } from "../light/Light";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";
import type { Texture } from "../texture";
import type { CubeTexture } from "../texture/CubeTexture";
import type { PMREMResult } from "../texture/PMREMGenerator";

export interface SceneEnvironmentOptions {
  /** Equirectangular HDR/LDR panorama texture */
  equirectangularMap?: Texture;
  /** Pre-filtered specular IBL cubemap (from PMREMGenerator) */
  prefilteredMap?: CubeTexture;
  /** Diffuse irradiance IBL cubemap (from PMREMGenerator) */
  irradianceMap?: CubeTexture;
  /** Environment intensity for IBL reflections (default: 1.0) */
  environmentIntensity?: number;
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

  /** Equirectangular environment map texture. */
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

  /** Checks if IBL (Image-Based Lighting) is fully configured (both prefilteredMap and irradianceMap are set). */
  get hasIBL(): boolean {
    return !!(this._prefilteredMap && this._irradianceMap);
  }

  /**
   * Sets the environment using PMREM-generated IBL maps.
   * @param pmrem - Pre-filtered environment maps from PMREMGenerator.fromEquirectangular()
   * @param options - Optional configuration for environment intensity
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

    this._equirectangularMap = undefined;
    this._prefilteredMap = pmrem.prefilteredMap;
    this._irradianceMap = pmrem.irradianceMap;

    if (options?.environmentIntensity !== undefined) {
      this._environmentIntensity = options.environmentIntensity;
    }
  }

  /**
   * Sets the environment using an equirectangular panorama texture.
   * @param texture - Equirectangular panorama texture (2:1 aspect ratio)
   * @param options - Optional configuration for environment intensity
   * @example
   * ```ts
   * const hdrTexture = await HDRLoader.load(device, 'panorama.hdr');
   * scene.setEnvironmentFromEquirectangular(hdrTexture);
   * ```
   */
  setEnvironmentFromEquirectangular(
    texture: Texture,
    options?: Partial<SceneEnvironmentOptions>,
  ): void {
    this._equirectangularMap = texture;
    this._prefilteredMap = undefined;
    this._irradianceMap = undefined;

    if (options?.environmentIntensity !== undefined) {
      this._environmentIntensity = options.environmentIntensity;
    }
  }

  /**
   * Sets the full environment configuration with manual control over all maps.
   * @param options - Complete environment configuration including maps and parameters
   */
  setEnvironment(options: SceneEnvironmentOptions): void {
    this._equirectangularMap = options.equirectangularMap;
    this._prefilteredMap = options.prefilteredMap;
    this._irradianceMap = options.irradianceMap;

    if (options.environmentIntensity !== undefined) {
      this._environmentIntensity = options.environmentIntensity;
    }
  }

  /**
   * Clears all environment map references.
   */
  clearEnvironment(): void {
    this._equirectangularMap = undefined;
    this._prefilteredMap = undefined;
    this._irradianceMap = undefined;
  }

  /**
   * Disposes resources owned by this scene.
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
