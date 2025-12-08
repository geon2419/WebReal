import { describe, it, expect } from "vitest";
import { FrustumGeometry } from "./FrustumGeometry";
import { PerspectiveCamera } from "../camera/PerspectiveCamera";
import { OrthographicCamera } from "../camera/OrthographicCamera";
import { Color, Vector3 } from "@web-real/math";

describe("FrustumGeometry", () => {
  describe("constructor", () => {
    it("should create frustum geometry with default colors", () => {
      const camera = new PerspectiveCamera({
        fov: 60,
        aspect: 16 / 9,
        near: 0.1,
        far: 100,
      });

      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBeGreaterThan(0);
      expect(frustum.positions.length).toBeGreaterThan(0);
      expect(frustum.colors.length).toBeGreaterThan(0);
    });

    it("should create frustum geometry with custom colors", () => {
      const camera = new PerspectiveCamera();
      const customColors = {
        near: new Color(1, 0, 0), // Red
        far: new Color(0, 1, 0), // Green
        sides: new Color(0, 0, 1), // Blue
        cone: new Color(1, 1, 1), // White
      };

      const frustum = new FrustumGeometry(camera, customColors);

      expect(frustum.vertexCount).toBeGreaterThan(0);
      expect(frustum.colors.length).toBeGreaterThan(0);
    });

    it("should work with orthographic camera", () => {
      const camera = new OrthographicCamera({
        left: -5,
        right: 5,
        top: 5,
        bottom: -5,
        near: 0.1,
        far: 50,
      });

      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBeGreaterThan(0);
      expect(frustum.positions.length).toBeGreaterThan(0);
    });

    it("should work with partial color overrides", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera, {
        near: new Color(1, 0, 0),
        // Other colors use defaults
      });

      expect(frustum.vertexCount).toBeGreaterThan(0);
    });
  });

  describe("geometry data structure", () => {
    it("should generate 32 vertices for 16 line segments", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      // 16 lines × 2 vertices per line = 32 vertices
      // 4 near edges + 4 far edges + 4 connecting edges + 4 cone edges
      expect(frustum.vertexCount).toBe(32);
      expect(frustum.positions.length).toBe(32 * 3);
      expect(frustum.colors.length).toBe(32 * 3);
    });

    it("should use non-indexed rendering", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      expect(frustum.indexCount).toBe(0);
      expect(frustum.indices.length).toBe(0);
    });

    it("should have empty normals array (not used for line rendering)", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      expect(frustum.normals.length).toBe(0);
    });

    it("should have matching position and color array lengths", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      // Both should have 3 components per vertex
      expect(frustum.positions.length).toBe(frustum.vertexCount * 3);
      expect(frustum.colors.length).toBe(frustum.vertexCount * 3);
    });
  });

  describe("positions", () => {
    it("should generate valid position coordinates", () => {
      const camera = new PerspectiveCamera({
        fov: 60,
        aspect: 1,
        near: 0.1,
        far: 10,
      });
      camera.position.set(0, 0, 5);

      const frustum = new FrustumGeometry(camera);
      const positions = frustum.positions;

      // All positions should be finite numbers
      for (let i = 0; i < positions.length; i++) {
        expect(Number.isFinite(positions[i])).toBe(true);
        expect(Number.isNaN(positions[i])).toBe(false);
      }
    });

    it("should have positions relative to camera position", () => {
      const camera = new PerspectiveCamera({
        fov: 60,
        aspect: 1,
        near: 1,
        far: 10,
      });
      const cameraPos = new Vector3(10, 20, 30);
      camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);

      const frustum = new FrustumGeometry(camera);
      const positions = frustum.positions;

      // Some positions should include the camera position (for cone lines)
      let hasCameraPosition = false;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];

        const distToCameraPos = Math.sqrt(
          Math.pow(x - cameraPos.x, 2) +
            Math.pow(y - cameraPos.y, 2) +
            Math.pow(z - cameraPos.z, 2)
        );

        if (distToCameraPos < 0.001) {
          hasCameraPosition = true;
          break;
        }
      }

      expect(hasCameraPosition).toBe(true);
    });

    it("should change when camera moves", () => {
      const camera = new PerspectiveCamera();
      camera.position.set(0, 0, 0);

      const frustum = new FrustumGeometry(camera);
      const positions1 = Array.from(frustum.positions);

      camera.position.set(10, 0, 0);
      frustum.update(camera);
      const positions2 = Array.from(frustum.positions);

      // Positions should be different after camera movement
      let hasDifference = false;
      for (let i = 0; i < positions1.length; i++) {
        if (Math.abs(positions1[i] - positions2[i]) > 0.001) {
          hasDifference = true;
          break;
        }
      }

      expect(hasDifference).toBe(true);
    });
  });

  describe("colors", () => {
    it("should have valid color values in range [0, 1]", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);
      const colors = frustum.colors;

      for (let i = 0; i < colors.length; i++) {
        expect(colors[i]).toBeGreaterThanOrEqual(0);
        expect(colors[i]).toBeLessThanOrEqual(1);
      }
    });

    it("should apply custom near color", () => {
      const camera = new PerspectiveCamera();
      const redColor = new Color(1, 0, 0);
      const frustum = new FrustumGeometry(camera, { near: redColor });
      const colors = frustum.colors;

      // Near plane has 4 edges × 2 vertices = 8 vertices at the start
      // Check first few vertices for red color
      let hasRedColor = false;
      for (let i = 0; i < Math.min(24, colors.length); i += 3) {
        const r = colors[i];
        const g = colors[i + 1];
        const b = colors[i + 2];

        if (
          Math.abs(r - 1) < 0.001 &&
          Math.abs(g - 0) < 0.001 &&
          Math.abs(b - 0) < 0.001
        ) {
          hasRedColor = true;
          break;
        }
      }

      expect(hasRedColor).toBe(true);
    });

    it("should contain different colors for different parts", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera, {
        near: new Color(1, 0, 0),
        far: new Color(0, 1, 0),
        sides: new Color(0, 0, 1),
        cone: new Color(1, 1, 0),
      });
      const colors = frustum.colors;

      const uniqueColors = new Set<string>();
      for (let i = 0; i < colors.length; i += 3) {
        const colorKey = `${colors[i].toFixed(2)},${colors[i + 1].toFixed(
          2
        )},${colors[i + 2].toFixed(2)}`;
        uniqueColors.add(colorKey);
      }

      // Should have at least 2 different colors
      expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("update method", () => {
    it("should update geometry when camera parameters change", () => {
      const camera = new PerspectiveCamera({ fov: 60, near: 0.1, far: 10 });
      const frustum = new FrustumGeometry(camera);

      const positions1 = Array.from(frustum.positions);

      // Change camera FOV
      camera.fov = 90;
      frustum.update(camera);
      const positions2 = Array.from(frustum.positions);

      // Positions should be different
      let hasDifference = false;
      for (let i = 0; i < positions1.length; i++) {
        if (Math.abs(positions1[i] - positions2[i]) > 0.001) {
          hasDifference = true;
          break;
        }
      }

      expect(hasDifference).toBe(true);
    });

    it("should update geometry when camera near/far planes change", () => {
      const camera = new PerspectiveCamera({ near: 0.1, far: 10 });
      const frustum = new FrustumGeometry(camera);

      const positions1 = Array.from(frustum.positions);

      camera.near = 1;
      camera.far = 100;
      frustum.update(camera);
      const positions2 = Array.from(frustum.positions);

      let hasDifference = false;
      for (let i = 0; i < positions1.length; i++) {
        if (Math.abs(positions1[i] - positions2[i]) > 0.001) {
          hasDifference = true;
          break;
        }
      }

      expect(hasDifference).toBe(true);
    });

    it("should maintain vertex count after update", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      const vertexCount1 = frustum.vertexCount;

      camera.fov = 90;
      frustum.update(camera);

      expect(frustum.vertexCount).toBe(vertexCount1);
      expect(frustum.vertexCount).toBe(32);
    });

    it("should work with different camera types", () => {
      const perspectiveCamera = new PerspectiveCamera();
      const orthographicCamera = new OrthographicCamera();

      const frustum = new FrustumGeometry(perspectiveCamera);
      expect(frustum.vertexCount).toBe(32);

      frustum.update(orthographicCamera);
      expect(frustum.vertexCount).toBe(32);
    });
  });

  describe("setColors method", () => {
    it("should update color configuration", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      const newColors = {
        near: new Color(1, 0, 0),
        far: new Color(0, 1, 0),
      };

      frustum.setColors(newColors);
      // Colors are updated in configuration, but need update() to apply to buffer
      frustum.update(camera);

      expect(frustum.colors.length).toBe(32 * 3);
    });

    it("should allow partial color updates", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      frustum.setColors({ near: new Color(1, 1, 1) });
      frustum.update(camera);

      expect(frustum.colors.length).toBe(32 * 3);
    });

    it("should reflect new colors after update", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera, {
        near: new Color(0, 0, 0),
      });

      frustum.setColors({ near: new Color(1, 0, 0) });
      frustum.update(camera);

      const colors = frustum.colors;
      let hasRedColor = false;
      for (let i = 0; i < Math.min(24, colors.length); i += 3) {
        if (
          Math.abs(colors[i] - 1) < 0.001 &&
          Math.abs(colors[i + 1] - 0) < 0.001 &&
          Math.abs(colors[i + 2] - 0) < 0.001
        ) {
          hasRedColor = true;
          break;
        }
      }

      expect(hasRedColor).toBe(true);
    });
  });

  describe("camera transformations", () => {
    it("should handle camera position and orientation changes", () => {
      const camera = new PerspectiveCamera();
      camera.position.set(0, 0, 5);
      camera.lookAt(new Vector3(0, 0, 0));

      const frustum = new FrustumGeometry(camera);
      const positions1 = Array.from(frustum.positions);

      // Change camera position and update lookAt
      camera.position.set(5, 5, 5);
      camera.lookAt(new Vector3(0, 0, 0));
      frustum.update(camera);
      const positions2 = Array.from(frustum.positions);

      let hasDifference = false;
      for (let i = 0; i < positions1.length; i++) {
        if (Math.abs(positions1[i] - positions2[i]) > 0.001) {
          hasDifference = true;
          break;
        }
      }

      expect(hasDifference).toBe(true);
    });

    it("should handle camera lookAt changes", () => {
      const camera = new PerspectiveCamera();
      camera.position.set(0, 0, 5);
      camera.lookAt(new Vector3(0, 0, 0));

      const frustum = new FrustumGeometry(camera);
      const positions1 = Array.from(frustum.positions);

      camera.lookAt(new Vector3(5, 5, 0));
      frustum.update(camera);
      const positions2 = Array.from(frustum.positions);

      let hasDifference = false;
      for (let i = 0; i < positions1.length; i++) {
        if (Math.abs(positions1[i] - positions2[i]) > 0.001) {
          hasDifference = true;
          break;
        }
      }

      expect(hasDifference).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle very small near plane", () => {
      const camera = new PerspectiveCamera({ near: 0.001, far: 100 });
      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBe(32);
      expect(Number.isFinite(frustum.positions[0])).toBe(true);
    });

    it("should handle very large far plane", () => {
      const camera = new PerspectiveCamera({ near: 0.1, far: 10000 });
      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBe(32);
      expect(Number.isFinite(frustum.positions[0])).toBe(true);
    });

    it("should handle extreme FOV values", () => {
      const camera = new PerspectiveCamera({ fov: 120, aspect: 1 });
      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBe(32);
      expect(Number.isFinite(frustum.positions[0])).toBe(true);
    });

    it("should handle extreme aspect ratios", () => {
      const camera = new PerspectiveCamera({ aspect: 10 });
      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBe(32);
      expect(Number.isFinite(frustum.positions[0])).toBe(true);
    });

    it("should handle orthographic camera with large bounds", () => {
      const camera = new OrthographicCamera({
        left: -1000,
        right: 1000,
        top: 1000,
        bottom: -1000,
        near: 0.1,
        far: 2000,
      });

      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBe(32);
      expect(Number.isFinite(frustum.positions[0])).toBe(true);
    });

    it("should handle camera at origin", () => {
      const camera = new PerspectiveCamera();
      camera.position.set(0, 0, 0);

      const frustum = new FrustumGeometry(camera);

      expect(frustum.vertexCount).toBe(32);
      expect(frustum.positions.length).toBe(96);
    });
  });

  describe("data consistency", () => {
    it("should have consistent data after multiple updates", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      for (let i = 0; i < 5; i++) {
        camera.fov = 60 + i * 10;
        frustum.update(camera);

        expect(frustum.vertexCount).toBe(32);
        expect(frustum.positions.length).toBe(32 * 3);
        expect(frustum.colors.length).toBe(32 * 3);
        expect(frustum.indexCount).toBe(0);
      }
    });

    it("should return same array references on multiple accesses", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      const positions1 = frustum.positions;
      const positions2 = frustum.positions;
      const colors1 = frustum.colors;
      const colors2 = frustum.colors;

      expect(positions1).toBe(positions2);
      expect(colors1).toBe(colors2);
    });

    it("should have new array references after update", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      const positions1 = frustum.positions;
      const colors1 = frustum.colors;

      camera.fov = 90;
      frustum.update(camera);

      const positions2 = frustum.positions;
      const colors2 = frustum.colors;

      // Arrays should be different instances after update
      expect(positions1).not.toBe(positions2);
      expect(colors1).not.toBe(colors2);
    });
  });

  describe("line segments structure", () => {
    it("should have pairs of vertices forming lines", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);

      // 32 vertices = 16 lines (each line has 2 vertices)
      expect(frustum.vertexCount % 2).toBe(0);

      const lineCount = frustum.vertexCount / 2;
      expect(lineCount).toBe(16);
    });

    it("should have distinct line endpoints", () => {
      const camera = new PerspectiveCamera();
      const frustum = new FrustumGeometry(camera);
      const positions = frustum.positions;

      // Check that most lines have different start and end points
      let distinctLineCount = 0;

      for (let i = 0; i < positions.length; i += 6) {
        const x1 = positions[i];
        const y1 = positions[i + 1];
        const z1 = positions[i + 2];
        const x2 = positions[i + 3];
        const y2 = positions[i + 4];
        const z2 = positions[i + 5];

        const distance = Math.sqrt(
          Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
        );

        if (distance > 0.001) {
          distinctLineCount++;
        }
      }

      // Most lines should have distinct endpoints
      expect(distinctLineCount).toBeGreaterThan(10);
    });
  });
});
