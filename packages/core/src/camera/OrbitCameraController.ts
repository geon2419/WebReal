import { Vector3 } from "@web-real/math";
import { Camera } from "./Camera";
import { OrthographicCamera } from "./OrthographicCamera";

/**
 * Configuration options for OrbitCameraController.
 */
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
  /** Minimum zoom (for OrthographicCamera) */
  minZoom?: number;
  /** Maximum zoom (for OrthographicCamera) */
  maxZoom?: number;
  /** Rotation speed */
  rotateSpeed?: number;
  /** Zoom speed */
  zoomSpeed?: number;
  /** Pan speed */
  panSpeed?: number;
}

/**
 * Controls camera orbit, pan, and zoom interactions around a target point using mouse input.
 *
 * @example
 * ```ts
 * const camera = new PerspectiveCamera(45, canvas.width / canvas.height);
 * const controller = new OrbitCameraController(camera, canvas, {
 *   target: new Vector3(0, 0, 0),
 *   radius: 10
 * });
 * // Left-click to rotate, right-click to pan, scroll to zoom
 * ```
 */
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
  private minZoom: number;
  private maxZoom: number;

  // Sensitivity
  private rotateSpeed: number;
  private zoomSpeed: number;
  private panSpeed: number;

  // Mouse state
  private isDragging = false;
  private isPanning = false;
  private previousMouseX = 0;
  private previousMouseY = 0;

  // Bound event handlers for cleanup
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseUpBound: (e: MouseEvent) => void;
  private onWheelBound: (e: WheelEvent) => void;
  private onContextMenuBound: (e: Event) => void;

  /**
   * Creates a new OrbitCameraController instance.
   * @param camera - The camera to control
   * @param canvas - The canvas element to attach mouse event listeners to
   * @param options - Configuration options for orbit behavior and constraints
   */
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

    // Warn if radius is negative and convert to absolute value
    if (this._radius < 0) {
      console.warn(
        `OrbitCameraController: negative radius ${
          this._radius
        } converted to ${Math.abs(this._radius)}`
      );
      this._radius = Math.abs(this._radius);
    }

    this._theta = options.theta ?? 0;
    this._phi = options.phi ?? Math.PI / 4; // 45 degrees

    // Constraints
    this.minRadius = options.minRadius ?? 1;
    this.maxRadius = options.maxRadius ?? 100;
    this.minPhi = options.minPhi ?? 0.01; // Nearly vertical above
    this.maxPhi = options.maxPhi ?? Math.PI - 0.01; // Nearly vertical below
    this.minZoom = options.minZoom ?? 0.1;
    this.maxZoom = options.maxZoom ?? 10;

    // Sensitivity
    this.rotateSpeed = options.rotateSpeed ?? 0.005;
    this.zoomSpeed = options.zoomSpeed ?? 0.1;
    this.panSpeed = options.panSpeed ?? 1.0;

    // Bind event handlers
    this.onMouseDownBound = this.onMouseDown.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onMouseUpBound = this.onMouseUp.bind(this);
    this.onWheelBound = this.onWheel.bind(this);
    this.onContextMenuBound = (e: Event) => e.preventDefault();

    // Attach event listeners
    this.canvas.addEventListener("mousedown", this.onMouseDownBound);
    // Track drag across the whole window so mouseup outside the canvas
    // doesn't leave the controller in a "stuck dragging" state.
    window.addEventListener("mousemove", this.onMouseMoveBound);
    window.addEventListener("mouseup", this.onMouseUpBound);
    this.canvas.addEventListener("wheel", this.onWheelBound, {
      passive: false,
    });
    this.canvas.addEventListener("contextmenu", this.onContextMenuBound);

    // Initial update
    this.update();
  }

  /**
   * Gets the current target point that the camera orbits around.
   * @returns A clone of the target position vector
   */
  get target(): Vector3 {
    return this._target.clone();
  }

  /**
   * Gets the current distance from the camera to the target.
   * @returns The radius in world units
   */
  get radius(): number {
    return this._radius;
  }

  /**
   * Sets the distance from the camera to the target.
   * @param value - The new radius, clamped to minRadius and maxRadius
   */
  set radius(value: number) {
    this._radius = Math.max(this.minRadius, Math.min(this.maxRadius, value));
  }

  /**
   * Gets the horizontal rotation angle around the target.
   * @returns The theta angle in radians
   */
  get theta(): number {
    return this._theta;
  }

  /**
   * Sets the horizontal rotation angle around the target.
   * @param value - The new theta angle in radians (not clamped)
   */
  set theta(value: number) {
    this._theta = value;
  }

  /**
   * Gets the vertical rotation angle from the target.
   * @returns The phi angle in radians
   */
  get phi(): number {
    return this._phi;
  }

  /**
   * Sets the vertical rotation angle from the target.
   * @param value - The new phi angle in radians, clamped to minPhi and maxPhi
   */
  set phi(value: number) {
    this._phi = Math.max(this.minPhi, Math.min(this.maxPhi, value));
  }

  /**
   * Updates the camera position and orientation based on current spherical coordinates.
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

    // Update world matrix immediately so camera helpers get correct position
    this.camera.updateWorldMatrix(false, false);
  }

  private onMouseDown(event: MouseEvent): void {
    // Handle left-click for rotation
    if (event.button === 0) {
      this.isDragging = true;
      this.previousMouseX = event.clientX;
      this.previousMouseY = event.clientY;
    }
    // Handle right-click for panning
    else if (event.button === 2) {
      this.isPanning = true;
      this.previousMouseX = event.clientX;
      this.previousMouseY = event.clientY;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging && !this.isPanning) return;

    const deltaX = event.clientX - this.previousMouseX;
    const deltaY = event.clientY - this.previousMouseY;

    if (this.isDragging) {
      // Update angles for rotation
      this._theta -= deltaX * this.rotateSpeed;
      this.phi += deltaY * this.rotateSpeed; // Constraints applied via setter (standard: dragging down tilts down)
    } else if (this.isPanning) {
      // Calculate camera coordinate system vectors
      const forward = this._target.sub(this.camera.position).normalize();
      const right = this.camera.up.cross(forward).normalize();
      const up = forward.cross(right).normalize();

      // Calculate pan offset with radius scaling and aspect ratio consideration
      const panX = (deltaX * this.panSpeed * this._radius) / this.canvas.width;
      const panY = (deltaY * this.panSpeed * this._radius) / this.canvas.height;

      const panOffset = right.scale(panX).add(up.scale(panY));

      // Update target position
      this._target.set(
        this._target.x + panOffset.x,
        this._target.y + panOffset.y,
        this._target.z + panOffset.z
      );
    }

    this.previousMouseX = event.clientX;
    this.previousMouseY = event.clientY;

    this.update();
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.isPanning = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();

    const delta = event.deltaY > 0 ? 1 : -1;

    // Handle zoom differently based on camera type
    if (this.camera instanceof OrthographicCamera) {
      // For orthographic cameras, adjust the zoom property (slower zoom speed)
      const newZoom = this.camera.zoom * (1 - delta * this.zoomSpeed * 0.1);
      this.camera.zoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, newZoom)
      );
    } else {
      // For perspective cameras, adjust the radius (distance)
      this.radius *= 1 + delta * this.zoomSpeed; // Constraints applied via setter
    }

    this.update();
  }

  /**
   * Removes all event listeners and cleans up resources.
   */
  dispose(): void {
    this.canvas.removeEventListener("mousedown", this.onMouseDownBound);
    window.removeEventListener("mousemove", this.onMouseMoveBound);
    window.removeEventListener("mouseup", this.onMouseUpBound);
    this.canvas.removeEventListener("wheel", this.onWheelBound);
    this.canvas.removeEventListener("contextmenu", this.onContextMenuBound);
  }
}
