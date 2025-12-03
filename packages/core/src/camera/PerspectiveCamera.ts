import { Matrix4 } from "@web-real-3d/math";
import { Camera } from "./Camera";

export interface PerspectiveCameraOptions {
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}

export class PerspectiveCamera extends Camera {
  public fov: number;
  public aspect: number;
  public near: number;
  public far: number;

  private _resizeObserver: ResizeObserver | null = null;

  constructor(options: PerspectiveCameraOptions = {}) {
    super();
    this.fov = options.fov ?? 60;
    this.aspect = options.aspect ?? 1;
    this.near = options.near ?? 0.1;
    this.far = options.far ?? 100;
  }

  /**
   * Gets the projection matrix.
   * Computed from fov, aspect, near, and far values.
   */
  get projectionMatrix(): Matrix4 {
    const fovRad = (this.fov * Math.PI) / 180;
    return Matrix4.perspective(fovRad, this.aspect, this.near, this.far);
  }

  updateAspect(canvas: HTMLCanvasElement): this {
    this.disposeResizeObserver();

    this.aspect = canvas.width / canvas.height;

    this._resizeObserver = new ResizeObserver(() => {
      this.aspect = canvas.width / canvas.height;
    });

    this._resizeObserver.observe(canvas);

    return this;
  }

  disposeResizeObserver(): void {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  dispose(): void {
    this.disposeResizeObserver();
  }
}
