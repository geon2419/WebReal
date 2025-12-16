import type { Color } from "@web-real/math";

/**
 * Manages the canvas color/depth render targets, including MSAA and resize handling.
 *
 * @example
 * ```ts
 * const targets = new RenderTargets({ device, context, format, canvas, sampleCount: 4 });
 * const { passEncoder } = targets.beginRenderPass({ commandEncoder, clearColor });
 * passEncoder.end();
 * targets.dispose();
 * ```
 */
export class RenderTargets {
  private _device: GPUDevice;
  private _context: GPUCanvasContext;
  private _format: GPUTextureFormat;
  private _canvas: HTMLCanvasElement;
  private _sampleCount: number;

  private _depthTexture!: GPUTexture;
  private _msaaTexture!: GPUTexture;
  private _resizeObserver: ResizeObserver;

  /**
   * Creates render targets for a canvas, recreating them on resize.
   * @param options - Construction options
   * @param options.device - The WebGPU device used to create textures
   * @param options.context - The canvas context used to acquire the current swapchain texture
   * @param options.format - The swapchain color format
   * @param options.canvas - The target canvas whose size drives texture sizes
   * @param options.sampleCount - The MSAA sample count for the color/depth targets
   */
  constructor(options: {
    device: GPUDevice;
    context: GPUCanvasContext;
    format: GPUTextureFormat;
    canvas: HTMLCanvasElement;
    sampleCount: number;
  }) {
    this._device = options.device;
    this._context = options.context;
    this._format = options.format;
    this._canvas = options.canvas;
    this._sampleCount = options.sampleCount;

    // Ensure canvas pixel size matches its CSS size (handles HiDPI/retina).
    this._syncCanvasPixelSize();

    this._createDepthTexture();
    this._createMSAATexture();

    this._resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        this._syncCanvasPixelSize(
          entry.contentRect.width,
          entry.contentRect.height
        );
      } else {
        this._syncCanvasPixelSize();
      }
      this._createDepthTexture();
      this._createMSAATexture();
    });

    this._resizeObserver.observe(this._canvas);
  }

  /**
   * Begins a render pass targeting the current swapchain texture.
   * @param options - Render pass options
   * @param options.commandEncoder - Command encoder used to begin the pass
   * @param options.clearColor - Clear color used for the color attachment
   * @returns The created render pass encoder
   */
  beginRenderPass(options: {
    commandEncoder: GPUCommandEncoder;
    clearColor: Color;
  }): { passEncoder: GPURenderPassEncoder } {
    const currentTexture = this._context.getCurrentTexture();
    const textureView = currentTexture.createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: this._msaaTexture.createView(),
          resolveTarget: textureView,
          clearValue: {
            r: options.clearColor.r,
            g: options.clearColor.g,
            b: options.clearColor.b,
            a: options.clearColor.a,
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this._depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    };

    const passEncoder =
      options.commandEncoder.beginRenderPass(renderPassDescriptor);

    return { passEncoder };
  }

  /**
   * Destroys owned textures and disconnects the resize observer.
   */
  dispose(): void {
    this._resizeObserver.disconnect();

    this._depthTexture?.destroy();
    this._msaaTexture?.destroy();
  }

  private _createDepthTexture(): void {
    this._depthTexture?.destroy();

    if (this._canvas.width <= 0 || this._canvas.height <= 0) {
      return;
    }

    this._depthTexture = this._device.createTexture({
      size: [this._canvas.width, this._canvas.height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this._sampleCount,
    });
  }

  private _createMSAATexture(): void {
    this._msaaTexture?.destroy();

    if (this._canvas.width <= 0 || this._canvas.height <= 0) {
      return;
    }

    this._msaaTexture = this._device.createTexture({
      size: [this._canvas.width, this._canvas.height],
      format: this._format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      sampleCount: this._sampleCount,
    });
  }

  private _syncCanvasPixelSize(cssWidth?: number, cssHeight?: number): void {
    // Use ResizeObserver contentRect when available; fallback to bounding box.
    const rect = this._canvas.getBoundingClientRect();
    const widthCss = cssWidth ?? rect.width;
    const heightCss = cssHeight ?? rect.height;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const width = Math.max(1, Math.floor(widthCss * dpr));
    const height = Math.max(1, Math.floor(heightCss * dpr));

    if (this._canvas.width !== width) {
      this._canvas.width = width;
    }
    if (this._canvas.height !== height) {
      this._canvas.height = height;
    }
  }
}
