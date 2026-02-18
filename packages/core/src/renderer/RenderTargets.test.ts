import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { RenderTargets } from "./RenderTargets";
import { Color } from "@web-real/math";

describe("RenderTargets", () => {
  let mockDevice: GPUDevice;
  let mockContext: GPUCanvasContext;
  let mockCanvas: HTMLCanvasElement;
  let mockTexture: GPUTexture;
  let mockCommandEncoder: GPUCommandEncoder;
  let mockPassEncoder: GPURenderPassEncoder;
  let resizeObserverCallback: ResizeObserverCallback | null;
  let originalResizeObserver: any;
  let originalGPUTextureUsage: any;

  const createMockCanvas = (cssWidth: number, cssHeight: number) =>
    ({
      width: cssWidth,
      height: cssHeight,
      getBoundingClientRect: () =>
        ({
          width: cssWidth,
          height: cssHeight,
        }) as DOMRect,
    }) as unknown as HTMLCanvasElement;

  beforeEach(() => {
    resizeObserverCallback = null;

    // Mock ResizeObserver for test environment
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
      observe = mock(() => {});
      disconnect = mock(() => {});
      unobserve = mock(() => {});
    } as any;

    // Bun test environment doesn't provide WebGPU constants.
    originalGPUTextureUsage = (globalThis as any).GPUTextureUsage;
    (globalThis as any).GPUTextureUsage = {
      RENDER_ATTACHMENT: 1,
    };

    mockTexture = {
      destroy: mock(() => {}),
      createView: mock(() => ({}) as GPUTextureView),
    } as unknown as GPUTexture;

    mockDevice = {
      createTexture: mock(() => mockTexture),
    } as unknown as GPUDevice;

    mockContext = {
      getCurrentTexture: mock(() => ({
        createView: () => ({}) as GPUTextureView,
      })),
    } as unknown as GPUCanvasContext;

    mockPassEncoder = {
      end: mock(() => {}),
    } as unknown as GPURenderPassEncoder;

    mockCommandEncoder = {
      beginRenderPass: mock(() => mockPassEncoder),
    } as unknown as GPUCommandEncoder;

    mockCanvas = createMockCanvas(800, 600);
  });

  describe("constructor", () => {
    it("should create depth and MSAA textures on initialization", () => {
      new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      // Should create depth texture + MSAA texture
      expect(mockDevice.createTexture).toHaveBeenCalledTimes(2);
    });

    it("should create textures with correct sample count", () => {
      new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 8,
      });

      const calls = (mockDevice.createTexture as any).mock.calls;
      // Both depth and MSAA should have sampleCount: 8
      expect(calls[0][0].sampleCount).toBe(8);
      expect(calls[1][0].sampleCount).toBe(8);
    });

    it("should create depth texture with depth24plus format", () => {
      new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      const calls = (mockDevice.createTexture as any).mock.calls;
      const depthCall = calls.find(
        (call: any) => call[0].format === "depth24plus",
      );
      expect(depthCall).toBeDefined();
      expect(depthCall[0].usage).toBe(GPUTextureUsage.RENDER_ATTACHMENT);
    });

    it("should create MSAA texture with specified format", () => {
      new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "rgba8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      const calls = (mockDevice.createTexture as any).mock.calls;
      const msaaCall = calls.find(
        (call: any) => call[0].format === "rgba8unorm",
      );
      expect(msaaCall).toBeDefined();
    });

    it("should create textures matching canvas dimensions", () => {
      const customCanvas = createMockCanvas(1920, 1080);

      new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: customCanvas,
        sampleCount: 4,
      });

      const calls = (mockDevice.createTexture as any).mock.calls;
      calls.forEach((call: any) => {
        expect(call[0].size).toEqual([1920, 1080]);
      });
    });

    it("should throw when depth texture creation fails", () => {
      const depthFailureDevice = {
        createTexture: mock(() => {
          throw new Error("Depth creation failed");
        }),
      } as unknown as GPUDevice;

      expect(
        () =>
          new RenderTargets({
            device: depthFailureDevice,
            context: mockContext,
            format: "bgra8unorm",
            canvas: mockCanvas,
            sampleCount: 4,
          }),
      ).toThrow(
        /failed to create depth texture \(width: 800, height: 600, format: depth24plus, sampleCount: 4\)/,
      );
    });

    it("should throw when MSAA texture creation fails", () => {
      const depthTexture = {
        destroy: mock(() => {}),
        createView: mock(() => ({}) as GPUTextureView),
      } as unknown as GPUTexture;

      const msaaFailureDevice = {
        createTexture: mock((descriptor: GPUTextureDescriptor) => {
          if (descriptor.format === "depth24plus") {
            return depthTexture;
          }

          throw new Error("MSAA creation failed");
        }),
      } as unknown as GPUDevice;

      expect(
        () =>
          new RenderTargets({
            device: msaaFailureDevice,
            context: mockContext,
            format: "bgra8unorm",
            canvas: mockCanvas,
            sampleCount: 4,
          }),
      ).toThrow(
        /failed to create MSAA texture \(width: 800, height: 600, format: bgra8unorm, sampleCount: 4\)/,
      );

      expect(depthTexture.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe("beginRenderPass", () => {
    it("should create a render pass with correct attachments", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      const clearColor = new Color(0.2, 0.3, 0.4, 1.0);
      const { passEncoder } = targets.beginRenderPass({
        commandEncoder: mockCommandEncoder,
        clearColor,
      });

      expect(passEncoder).toBe(mockPassEncoder);
      expect(mockCommandEncoder.beginRenderPass).toHaveBeenCalledTimes(1);
    });

    it("should use correct clear color values", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      const clearColor = new Color(0.1, 0.2, 0.3, 0.5);
      targets.beginRenderPass({
        commandEncoder: mockCommandEncoder,
        clearColor,
      });

      const descriptor = (mockCommandEncoder.beginRenderPass as any).mock
        .calls[0][0];
      const colorAttachment = descriptor.colorAttachments[0];

      expect(colorAttachment.clearValue.r).toBe(0.1);
      expect(colorAttachment.clearValue.g).toBe(0.2);
      expect(colorAttachment.clearValue.b).toBe(0.3);
      expect(colorAttachment.clearValue.a).toBe(0.5);
    });

    it("should configure depth attachment with clear value of 1.0", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      targets.beginRenderPass({
        commandEncoder: mockCommandEncoder,
        clearColor: new Color(0, 0, 0, 1),
      });

      const descriptor = (mockCommandEncoder.beginRenderPass as any).mock
        .calls[0][0];
      const depthAttachment = descriptor.depthStencilAttachment;

      expect(depthAttachment.depthClearValue).toBe(1.0);
      expect(depthAttachment.depthLoadOp).toBe("clear");
      expect(depthAttachment.depthStoreOp).toBe("store");
    });

    it("should use current swapchain texture as resolve target", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      targets.beginRenderPass({
        commandEncoder: mockCommandEncoder,
        clearColor: new Color(0, 0, 0, 1),
      });

      expect(mockContext.getCurrentTexture).toHaveBeenCalledTimes(1);
    });

    it("should rethrow fatal attachment recreation errors captured during resize", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      expect(resizeObserverCallback).toBeDefined();

      (mockDevice.createTexture as any).mockImplementation(
        (descriptor: GPUTextureDescriptor) => {
          if (descriptor.format === "depth24plus") {
            throw new Error("Resize depth failure");
          }

          return mockTexture;
        },
      );

      resizeObserverCallback?.(
        [
          {
            contentRect: { width: 800, height: 600 },
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );

      expect(() =>
        targets.beginRenderPass({
          commandEncoder: mockCommandEncoder,
          clearColor: new Color(0, 0, 0, 1),
        }),
      ).toThrow(
        /failed to create depth texture \(width: 800, height: 600, format: depth24plus, sampleCount: 4\)/,
      );
    });

    it("should clear fatal error after a successful resize recreation", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      expect(resizeObserverCallback).toBeDefined();

      let shouldFail = true;
      (mockDevice.createTexture as any).mockImplementation(
        (descriptor: GPUTextureDescriptor) => {
          if (shouldFail && descriptor.format === "depth24plus") {
            throw new Error("Resize depth failure");
          }

          return mockTexture;
        },
      );

      resizeObserverCallback?.(
        [
          {
            contentRect: { width: 800, height: 600 },
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );

      expect(() =>
        targets.beginRenderPass({
          commandEncoder: mockCommandEncoder,
          clearColor: new Color(0, 0, 0, 1),
        }),
      ).toThrow(
        /failed to create depth texture \(width: 800, height: 600, format: depth24plus, sampleCount: 4\)/,
      );

      shouldFail = false;
      resizeObserverCallback?.(
        [
          {
            contentRect: { width: 800, height: 600 },
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );

      expect(() =>
        targets.beginRenderPass({
          commandEncoder: mockCommandEncoder,
          clearColor: new Color(0, 0, 0, 1),
        }),
      ).not.toThrow();
    });
  });

  describe("dispose", () => {
    it("should destroy depth and MSAA textures", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      targets.dispose();

      // Should destroy both textures (depth + MSAA)
      expect(mockTexture.destroy).toHaveBeenCalledTimes(2);
    });

    it("should handle multiple dispose calls safely", () => {
      const targets = new RenderTargets({
        device: mockDevice,
        context: mockContext,
        format: "bgra8unorm",
        canvas: mockCanvas,
        sampleCount: 4,
      });

      targets.dispose();
      targets.dispose();

      // Should not throw
      expect(mockTexture.destroy).toHaveBeenCalled();
    });
  });

  afterEach(() => {
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    }
    if (typeof originalGPUTextureUsage === "undefined") {
      delete (globalThis as any).GPUTextureUsage;
    } else {
      (globalThis as any).GPUTextureUsage = originalGPUTextureUsage;
    }
  });
});
