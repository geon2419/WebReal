import { Matrix4 } from "@web-real/math";
import { Camera } from "./Camera";

export interface OrthographicCameraOptions {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  near?: number;
  far?: number;
  zoom?: number;
}

/**
 * Orthographic camera that supports zoom and viewport updates.
 */
export class OrthographicCamera extends Camera {
  public left: number;
  public right: number;
  public top: number;
  public bottom: number;
  public near: number;
  public far: number;
  public zoom: number;

  private _resizeObserver: ResizeObserver | null = null;

  constructor(options: OrthographicCameraOptions = {}) {
    super();
    this.left = options.left ?? -1;
    this.right = options.right ?? 1;
    this.top = options.top ?? 1;
    this.bottom = options.bottom ?? -1;
    this.near = options.near ?? 0.1;
    this.far = options.far ?? 100;
    this.zoom = options.zoom ?? 1;
  }

  get projectionMatrix(): Matrix4 {
    const scale = 1 / this.zoom;

    const cx = (this.left + this.right) / 2;
    const cy = (this.top + this.bottom) / 2;
    const width = (this.right - this.left) * scale;
    const height = (this.top - this.bottom) * scale;

    const left = cx - width / 2;
    const right = cx + width / 2;
    const bottom = cy - height / 2;
    const top = cy + height / 2;

    return Matrix4.orthographic(left, right, bottom, top, this.near, this.far);
  }

  /**
   * Centers the view box using the provided dimensions.
   */
  setViewport(width: number, height: number): this {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    this.left = -halfWidth;
    this.right = halfWidth;
    this.top = halfHeight;
    this.bottom = -halfHeight;
    return this;
  }

  /**
   * Mirrors the canvas size and observes future resizes.
   */
  updateViewport(canvas: HTMLCanvasElement): this {
    this.disposeResizeObserver();

    this.setViewport(canvas.width, canvas.height);

    this._resizeObserver = new ResizeObserver(() => {
      this.setViewport(canvas.width, canvas.height);
    });

    this._resizeObserver.observe(canvas);

    return this;
  }

  /**
   * Disconnects the resize observer if active.
   */
  disposeResizeObserver(): void {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  /**
   * Cleans up any observers before disposal.
   */
  dispose(): void {
    this.disposeResizeObserver();
  }
}
