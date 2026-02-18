import { describe, it, expect, beforeEach, mock } from "bun:test";
import { SkyboxPass } from "./SkyboxPass";
import { SkyboxMaterial } from "../material/SkyboxMaterial";
import { FallbackResources } from "./FallbackResources";
import { PerspectiveCamera } from "../camera/PerspectiveCamera";

// Mock WebGPU constants for test environment
if (typeof globalThis.GPUBufferUsage === "undefined") {
  (globalThis as any).GPUBufferUsage = {
    UNIFORM: 0x0040,
    COPY_DST: 0x0008,
  };
}

if (typeof globalThis.GPUTextureUsage === "undefined") {
  (globalThis as any).GPUTextureUsage = {
    TEXTURE_BINDING: 0x04,
    COPY_DST: 0x08,
    RENDER_ATTACHMENT: 0x10,
  };
}

describe("SkyboxPass", () => {
  let mockDevice: GPUDevice;
  let mockFallback: FallbackResources;
  let mockPipeline: GPURenderPipeline;
  let mockBuffer: GPUBuffer;
  let mockBindGroup: GPUBindGroup;
  let mockPassEncoder: GPURenderPassEncoder;
  let mockQueue: GPUQueue;
  let mockTexture: GPUTexture;

  beforeEach(() => {
    mockBuffer = { destroy: mock(() => {}) } as unknown as GPUBuffer;
    mockBindGroup = {} as GPUBindGroup;

    mockTexture = {
      createView: mock(() => ({}) as GPUTextureView),
      destroy: mock(() => {}),
    } as unknown as GPUTexture;

    mockPipeline = {
      getBindGroupLayout: mock(
        (index: number) =>
          ({
            label: `Bind Group Layout ${index}`,
          }) as GPUBindGroupLayout,
      ),
    } as unknown as GPURenderPipeline;

    mockQueue = {
      writeBuffer: mock(() => {}),
      writeTexture: mock(() => {}),
    } as unknown as GPUQueue;

    mockDevice = {
      createShaderModule: mock(() => ({}) as GPUShaderModule),
      createRenderPipeline: mock(() => mockPipeline),
      createBuffer: mock(() => mockBuffer),
      createBindGroup: mock(() => mockBindGroup),
      createTexture: mock(() => mockTexture),
      createSampler: mock(() => ({}) as GPUSampler),
      queue: mockQueue,
    } as unknown as GPUDevice;

    mockFallback = {
      getDummyCubeTexture: mock(() => ({
        createView: () => ({}) as GPUTextureView,
      })),
      getDummyBrdfLUT: mock(() => ({
        createView: () => ({}) as GPUTextureView,
      })),
      getLinearSampler: mock(() => ({}) as GPUSampler),
    } as unknown as FallbackResources;

    mockPassEncoder = {
      setPipeline: mock(() => {}),
      setBindGroup: mock(() => {}),
      draw: mock(() => {}),
    } as unknown as GPURenderPassEncoder;
  });

  describe("render", () => {
    it("should create pipeline and resources for first render", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({});
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);

      // Should create pipeline
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
      // Should create uniform buffer
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(1);
      // Should create bind group
      expect(mockDevice.createBindGroup).toHaveBeenCalledTimes(1);
    });

    it("should reuse cached resources for same material", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({});
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);
      skyboxPass.render(mockPassEncoder, material, camera);

      // Should only create pipeline and resources once
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(1);
    });

    it("should recreate resources when material changes", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material1 = new SkyboxMaterial({ exposure: 1.0 });
      const material2 = new SkyboxMaterial({ exposure: 2.0 });
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material1, camera);
      skyboxPass.render(mockPassEncoder, material2, camera);

      // Should destroy old buffer and create new resources
      expect(mockBuffer.destroy).toHaveBeenCalledTimes(1);
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(2);
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(2);
    });

    it("should update bind group when bindingRevision changes", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({});
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);

      // Simulate binding revision change (e.g., texture swap)
      (material as any)._bindingRevision = 1;

      skyboxPass.render(mockPassEncoder, material, camera);

      // Should NOT destroy buffer or create new pipeline
      expect(mockBuffer.destroy).not.toHaveBeenCalled();
      expect(mockDevice.createRenderPipeline).toHaveBeenCalledTimes(1);
      // Should create new bind group
      expect(mockDevice.createBindGroup).toHaveBeenCalledTimes(2);
    });

    it("should write uniform data to buffer on each render", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({});
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);

      expect(mockQueue.writeBuffer).toHaveBeenCalledTimes(1);
      const call = (mockQueue.writeBuffer as any).mock.calls[0];
      expect(call[0]).toBe(mockBuffer); // Writing to uniform buffer
    });

    it("should execute draw commands correctly", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({});
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);

      expect(mockPassEncoder.setPipeline).toHaveBeenCalledWith(mockPipeline);
      expect(mockPassEncoder.setBindGroup).toHaveBeenCalledWith(
        0,
        mockBindGroup,
      );
      // Skybox uses fullscreen triangle (3 vertices)
      expect(mockPassEncoder.draw).toHaveBeenCalledWith(3);
    });

    it("should use fallback cube texture when no cube map provided", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({}); // No cube map
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);

      expect(mockFallback.getDummyCubeTexture).toHaveBeenCalled();
    });
  });

  describe("dispose", () => {
    it("should destroy uniform buffer when disposed", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({});
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);
      skyboxPass.dispose();

      expect(mockBuffer.destroy).toHaveBeenCalledTimes(1);
    });

    it("should handle dispose without prior render", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      // Should not throw
      skyboxPass.dispose();

      expect(mockBuffer.destroy).not.toHaveBeenCalled();
    });

    it("should handle multiple dispose calls safely", () => {
      const skyboxPass = new SkyboxPass({
        device: mockDevice,
        format: "bgra8unorm",
        sampleCount: 4,
        fallback: mockFallback,
      });

      const material = new SkyboxMaterial({});
      const camera = new PerspectiveCamera({ fov: 75, aspect: 1.0 });

      skyboxPass.render(mockPassEncoder, material, camera);
      skyboxPass.dispose();
      skyboxPass.dispose();

      // Should only destroy once
      expect(mockBuffer.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
