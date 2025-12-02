export interface EngineOptions {
  canvas: HTMLCanvasElement;
  format?: GPUTextureFormat;
  powerPreference?: GPUPowerPreference;
}

export class Engine {
  private _canvas: HTMLCanvasElement;
  private _device!: GPUDevice;
  private _context!: GPUCanvasContext;
  private _format!: GPUTextureFormat;

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

  static async create(options: EngineOptions): Promise<Engine> {
    const engine = new Engine(options.canvas);
    await engine._initialize(options);
    return engine;
  }

  private async _initialize(options: EngineOptions): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: options.powerPreference ?? 'high-performance',
    });
    if (!adapter) {
      throw new Error('Failed to get GPU adapter');
    }

    this._device = await adapter.requestDevice();
    this._device.lost.then((info) => {
      console.error(`WebGPU device lost: ${info.message}`);
      this.stop();
    });

    const context = this._canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Failed to get WebGPU context');
    }

    this._context = context;

    this._format = options.format ?? navigator.gpu.getPreferredCanvasFormat();
    this._context.configure({
      device: this._device,
      format: this._format,
      alphaMode: 'premultiplied',
    });
  }

  run(onFrame: (deltaTime: number) => void): void {
    if (this._running){
       return;
    }
    this._running = true;
    this._lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this._running){
        return;
      }

      const deltaTime = (currentTime - this._lastTime) / 1000;
      this._lastTime = currentTime;

      onFrame(deltaTime);

      this._animationFrameId = requestAnimationFrame(loop);
    };

    this._animationFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    this._running = false;

    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = 0;
    }
  }

  dispose(): void {
    this.stop();
    this._device.destroy();
  }
}
