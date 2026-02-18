/**
 * Configuration options for creating a WebGPU engine instance.
 */
export interface EngineOptions {
  canvas: HTMLCanvasElement;
  format?: GPUTextureFormat;
  powerPreference?: GPUPowerPreference;
  /**
   * Optional GPU features to request when creating the device.
   * Use this to enable features like 'timestamp-query' for compute profiling.
   * @example ['timestamp-query']
   */
  requiredFeatures?: GPUFeatureName[];
}

/**
 * Core WebGPU rendering engine that manages device initialization and the render loop.
 *
 * @example
 * ```ts
 * const canvas = document.querySelector('canvas')!;
 * const engine = await Engine.create({ canvas });
 * engine.run((deltaTime) => {
 *   // Render frame
 * });
 * ```
 */
export class Engine {
  private _canvas: HTMLCanvasElement;
  private _device!: GPUDevice;
  private _context!: GPUCanvasContext;
  private _format!: GPUTextureFormat;
  private _isDisposed = false;

  private _running = false;
  private _lastTime = 0;
  private _animationFrameId = 0;

  private constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
  }

  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  get device(): GPUDevice {
    return this._device;
  }

  get context(): GPUCanvasContext {
    return this._context;
  }

  get format(): GPUTextureFormat {
    return this._format;
  }

  get isRunning(): boolean {
    return this._running;
  }

  /**
   * Creates and initializes a new Engine instance with WebGPU support.
   * @param options - Configuration options for the engine
   * @returns A promise that resolves to the initialized Engine instance
   * @throws {Error} If WebGPU is not supported or initialization fails
   */
  static async create(options: EngineOptions): Promise<Engine> {
    const engine = new Engine(options.canvas);
    await engine._initialize(options);
    return engine;
  }

  private async _initialize(options: EngineOptions): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser");
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: options.powerPreference ?? "high-performance",
    });
    if (!adapter) {
      throw new Error("Failed to get GPU adapter");
    }

    // Filter requested features to only those supported by the adapter
    const requestedFeatures = options.requiredFeatures ?? [];
    const supportedFeatures = requestedFeatures.filter((feature) =>
      adapter.features.has(feature),
    );

    if (supportedFeatures.length < requestedFeatures.length) {
      const unsupported = requestedFeatures.filter(
        (f) => !supportedFeatures.includes(f),
      );
      console.warn(
        `[Engine] Some requested features are not supported: ${unsupported.join(", ")}`,
      );
    }

    this._device = await adapter.requestDevice({
      requiredFeatures: supportedFeatures,
    });
    this._device.lost.then((info) => {
      if (this._isDisposed) {
        return;
      }

      if (info.reason === "destroyed") {
        return;
      }

      this.stop();
      console.error(`WebGPU device lost: ${info.message}`);
    });

    const context = this._canvas.getContext("webgpu");
    if (!context) {
      throw new Error("Failed to get WebGPU context");
    }

    this._context = context;

    this._format = options.format ?? navigator.gpu.getPreferredCanvasFormat();
    this._context.configure({
      device: this._device,
      format: this._format,
      alphaMode: "premultiplied",
    });
  }

  /**
   * Starts the render loop and calls the provided callback for each frame.
   * @param onFrame - Callback function that receives deltaTime in seconds
   */
  run(onFrame: (deltaTime: number) => void): void {
    if (this._running) {
      return;
    }
    this._running = true;
    this._lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this._running) {
        return;
      }

      const deltaTime = (currentTime - this._lastTime) / 1000;
      this._lastTime = currentTime;

      onFrame(deltaTime);

      this._animationFrameId = requestAnimationFrame(loop);
    };

    this._animationFrameId = requestAnimationFrame(loop);
  }

  /**
   * Stops the render loop and cancels the animation frame.
   */
  stop(): void {
    this._running = false;

    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = 0;
    }
  }

  /**
   * Stops the render loop and destroys the WebGPU device.
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.stop();
    this._device.destroy();
  }
}
