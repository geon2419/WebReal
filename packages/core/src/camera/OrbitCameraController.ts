import { Vector3 } from "@web-real/math";
import { Camera } from "./Camera";

export interface OrbitCameraControllerOptions {
  /** Target point for rotation */
  target?: Vector3;
  /** Distance to target */
  radius?: number;
  /** Horizontal rotation angle (radians) */
  theta?: number;
  /** Vertical rotation angle (radians) */
  phi?: number;
  /** Minimum distance */
  minRadius?: number;
  /** Maximum distance */
  maxRadius?: number;
  /** Minimum vertical angle (radians) */
  minPhi?: number;
  /** Maximum vertical angle (radians) */
  maxPhi?: number;
  /** Rotation speed */
  rotateSpeed?: number;
  /** Zoom speed */
  zoomSpeed?: number;
}

export class OrbitCameraController {
  private camera: Camera;
  private canvas: HTMLCanvasElement;

  // Spherical coordinates
  private _target: Vector3;
  private _radius: number;
  private _theta: number; // azimuthal angle (horizontal)
  private _phi: number; // polar angle (vertical)

  // Constraints
  private minRadius: number;
  private maxRadius: number;
  private minPhi: number;
  private maxPhi: number;

  // Sensitivity
  private rotateSpeed: number;
  private zoomSpeed: number;

  // Mouse state
  private isDragging = false;
  private previousMouseX = 0;
  private previousMouseY = 0;

  // Bound event handlers for cleanup
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseUpBound: (e: MouseEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onContextMenuBound: (e: Event) => void;

  constructor(
    camera: Camera,
    canvas: HTMLCanvasElement,
    options: OrbitCameraControllerOptions = {}
  ) {
    this.camera = camera;
    this.canvas = canvas;

    // Initialize spherical coordinates
    this._target = options.target?.clone() ?? new Vector3(0, 0, 0);
    this._radius = options.radius ?? 5;
    this._theta = options.theta ?? 0;
    this._phi = options.phi ?? Math.PI / 4; // 45 degrees

    // Constraints
    this.minRadius = options.minRadius ?? 1;
    this.maxRadius = options.maxRadius ?? 100;
    this.minPhi = options.minPhi ?? 0.01; // Nearly vertical above
    this.maxPhi = options.maxPhi ?? Math.PI - 0.01; // Nearly vertical below

    // Sensitivity
    this.rotateSpeed = options.rotateSpeed ?? 0.005;
    this.zoomSpeed = options.zoomSpeed ?? 0.1;

    // Bind event handlers
    this.onMouseDownBound = this.onMouseDown.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onMouseUpBound = this.onMouseUp.bind(this);
    this.onWheelBound = this.onWheel.bind(this);
    this.onContextMenuBound = (e: Event) => e.preventDefault();

    // Attach event listeners
    this.canvas.addEventListener("mousedown", this.onMouseDownBound);
    this.canvas.addEventListener("mousemove", this.onMouseMoveBound);
    this.canvas.addEventListener("mouseup", this.onMouseUpBound);
    this.canvas.addEventListener("mouseleave", this.onMouseUpBound);
    this.canvas.addEventListener("wheel", this.onWheelBound, {
      passive: false,
    });
    this.canvas.addEventListener("contextmenu", this.onContextMenuBound);

    // Initial update
    this.update();
  }

  get target(): Vector3 {
    return this._target;
  }

  get radius(): number {
    return this._radius;
  }

  set radius(value: number) {
    this._radius = Math.max(this.minRadius, Math.min(this.maxRadius, value));
  }

  get theta(): number {
    return this._theta;
  }

  set theta(value: number) {
    this._theta = value;
  }

  get phi(): number {
    return this._phi;
  }

  set phi(value: number) {
    this._phi = Math.max(this.minPhi, Math.min(this.maxPhi, value));
  }

  /**
   * Update camera position by converting spherical coordinates to Cartesian coordinates
   */
  update(): void {
    // Spherical to Cartesian conversion
    // x = r * sin(phi) * sin(theta)
    // y = r * cos(phi)
    // z = r * sin(phi) * cos(theta)
    const sinPhi = Math.sin(this._phi);
    const cosPhi = Math.cos(this._phi);
    const sinTheta = Math.sin(this._theta);
    const cosTheta = Math.cos(this._theta);

    const x = this._target.x + this._radius * sinPhi * sinTheta;
    const y = this._target.y + this._radius * cosPhi;
    const z = this._target.z + this._radius * sinPhi * cosTheta;

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this._target);
  }

  private onMouseDown(event: MouseEvent): void {
    // Handle left-click only
    if (event.button !== 0) return;

    this.isDragging = true;
    this.previousMouseX = event.clientX;
    this.previousMouseY = event.clientY;
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.previousMouseX;
    const deltaY = event.clientY - this.previousMouseY;

    // Update angles
    this._theta -= deltaX * this.rotateSpeed;
    this.phi += deltaY * this.rotateSpeed; // Constraints applied via setter (standard: dragging down tilts down)

    this.previousMouseX = event.clientX;
    this.previousMouseY = event.clientY;

    this.update();
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();

    // Zoom in/out
    const delta = event.deltaY > 0 ? 1 : -1;
    this.radius *= 1 + delta * this.zoomSpeed; // Constraints applied via setter

    this.update();
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    this.canvas.removeEventListener("mousedown", this.onMouseDownBound);
    this.canvas.removeEventListener("mousemove", this.onMouseMoveBound);
    this.canvas.removeEventListener("mouseup", this.onMouseUpBound);
    this.canvas.removeEventListener("mouseleave", this.onMouseUpBound);
    this.canvas.removeEventListener("wheel", this.onWheelBound);
    this.canvas.removeEventListener("contextmenu", this.onContextMenuBound);
  }
}
