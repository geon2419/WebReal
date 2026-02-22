import { describe, it, expect } from "bun:test";
import { Scene } from "./Scene";
import { Object3D } from "./Object3D";
import { Mesh } from "./Mesh";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";
import { BoxGeometry } from "../geometry/BoxGeometry";
import { BasicMaterial } from "../material/BasicMaterial";
import type { Texture } from "../texture";
import type { CubeTexture } from "../texture/CubeTexture";

describe("Scene", () => {
  describe("scene graph operations", () => {
    it("should initialize as empty visible scene extending Object3D", () => {
      const scene = new Scene();

      expect(scene).toBeInstanceOf(Object3D);
      expect(scene.children).toEqual([]);
      expect(scene.visible).toBe(true);
    });

    it("should add and remove various object types (meshes, lights, objects)", () => {
      const scene = new Scene();
      const mesh = new Mesh(new BoxGeometry(), new BasicMaterial());
      const light = new DirectionalLight();
      const obj = new Object3D();

      scene.add(mesh).add(light).add(obj);
      expect(scene.children.length).toBe(3);

      scene.remove(light);
      expect(scene.children.length).toBe(2);
      expect(scene.children).not.toContain(light);
    });

    it("should support method chaining for add operations", () => {
      const scene = new Scene();
      const obj1 = new Object3D();
      const obj2 = new Object3D();

      const result = scene.add(obj1).add(obj2);

      expect(result).toBe(scene);
      expect(scene.children).toEqual([obj1, obj2]);
    });

    it("should handle duplicate add/remove operations safely", () => {
      const scene = new Scene();
      const obj = new Object3D();

      scene.add(obj).add(obj);
      expect(scene.children.length).toBe(1);

      scene.remove(obj).remove(obj);
      expect(scene.children.length).toBe(0);
    });
  });

  describe("traverse", () => {
    it("should traverse all descendants in scene graph", () => {
      const scene = new Scene();
      const parent = new Object3D();
      const child1 = new Object3D();
      const child2 = new Object3D();

      scene.add(parent);
      parent.add(child1).add(child2);

      const visited: Object3D[] = [];
      scene.traverse((obj) => visited.push(obj));

      expect(visited).toEqual([scene, parent, child1, child2]);
    });

    it("should allow mutation during traversal", () => {
      const scene = new Scene();
      const obj1 = new Object3D();
      const obj2 = new Object3D();

      scene.add(obj1).add(obj2);
      scene.traverse((obj) => (obj.visible = false));

      expect(scene.visible).toBe(false);
      expect(obj1.visible).toBe(false);
      expect(obj2.visible).toBe(false);
    });
  });

  describe("updateMatrixWorld", () => {
    it("should propagate transforms through nested hierarchies", () => {
      const scene = new Scene();
      const parent = new Object3D();
      const child = new Object3D();
      const grandchild = new Object3D();

      parent.position.x = 10;
      child.position.y = 5;
      grandchild.position.z = 3;

      scene.add(parent);
      parent.add(child);
      child.add(grandchild);

      scene.updateMatrixWorld();

      // Verify transformation was applied by checking world matrix is not identity
      const isIdentity = (m: Float32Array) =>
        m.every((v, i) => (i % 5 === 0 ? v === 1 : v === 0));

      expect(isIdentity(parent.worldMatrix.data)).toBe(false);
      expect(isIdentity(child.worldMatrix.data)).toBe(false);
      expect(isIdentity(grandchild.worldMatrix.data)).toBe(false);
    });

    it("should handle empty scene without errors", () => {
      const scene = new Scene();
      expect(() => scene.updateMatrixWorld()).not.toThrow();
    });
  });

  describe("findFirstLight", () => {
    it("should return undefined when no lights exist", () => {
      const scene = new Scene();
      scene.add(new Object3D());
      scene.add(new Mesh(new BoxGeometry(), new BasicMaterial()));

      expect(scene.findFirstLight()).toBeUndefined();
    });

    it("should find lights in nested hierarchies", () => {
      const scene = new Scene();
      const container = new Object3D();
      const light = new PointLight();

      scene.add(container);
      container.add(light);

      expect(scene.findFirstLight()).toBe(light);
    });

    it("should filter by light type", () => {
      const scene = new Scene();
      const pointLight = new PointLight();
      const directionalLight = new DirectionalLight();

      scene.add(pointLight).add(directionalLight);

      expect(scene.findFirstLight(DirectionalLight)).toBe(directionalLight);
      expect(scene.findFirstLight(PointLight)).toBe(pointLight);
    });

    it("should return undefined when type filter doesn't match", () => {
      const scene = new Scene();
      scene.add(new DirectionalLight());

      expect(scene.findFirstLight(PointLight)).toBeUndefined();
    });

    it("should return first light when multiple exist", () => {
      const scene = new Scene();
      const light1 = new DirectionalLight();
      const light2 = new PointLight();

      scene.add(light1).add(light2);

      expect(scene.findFirstLight()).toBe(light1);
    });
  });

  describe("environment configuration", () => {
    it("should store PMREM maps and mark IBL as configured", () => {
      const scene = new Scene();
      const prefilteredMap = {} as CubeTexture;
      const irradianceMap = {} as CubeTexture;

      scene.setEnvironmentFromPMREM({ prefilteredMap, irradianceMap } as any, {
        environmentIntensity: 1.5,
      });

      expect(scene.equirectangularMap).toBeUndefined();
      expect(scene.prefilteredMap).toBe(prefilteredMap);
      expect(scene.irradianceMap).toBe(irradianceMap);
      expect(scene.environmentIntensity).toBe(1.5);
      expect(scene.hasIBL).toBe(true);
    });

    it("should store equirectangular map and clear IBL maps", () => {
      const scene = new Scene();
      const prefilteredMap = {} as CubeTexture;
      const irradianceMap = {} as CubeTexture;
      const equirectangularMap = {} as Texture;

      scene.setEnvironmentFromPMREM({ prefilteredMap, irradianceMap } as any, {
        environmentIntensity: 1.5,
      });
      scene.setEnvironmentFromEquirectangular(equirectangularMap, {
        environmentIntensity: 0.8,
      });

      expect(scene.equirectangularMap).toBe(equirectangularMap);
      expect(scene.prefilteredMap).toBeUndefined();
      expect(scene.irradianceMap).toBeUndefined();
      expect(scene.environmentIntensity).toBe(0.8);
      expect(scene.hasIBL).toBe(false);
    });

    it("should clear all environment map references", () => {
      const scene = new Scene();
      const prefilteredMap = {} as CubeTexture;
      const irradianceMap = {} as CubeTexture;
      const equirectangularMap = {} as Texture;

      scene.setEnvironment({
        equirectangularMap,
        prefilteredMap,
        irradianceMap,
        environmentIntensity: 2.0,
      });

      scene.clearEnvironment();

      expect(scene.equirectangularMap).toBeUndefined();
      expect(scene.prefilteredMap).toBeUndefined();
      expect(scene.irradianceMap).toBeUndefined();
      expect(scene.hasIBL).toBe(false);
    });

    it("should throw when setEnvironmentFromPMREM missing prefilteredMap", () => {
      const scene = new Scene();

      expect(() =>
        scene.setEnvironmentFromPMREM({
          prefilteredMap: undefined as any,
          irradianceMap: {} as any,
        } as any),
      ).toThrow(
        "Scene.setEnvironmentFromPMREM() requires pmrem.prefilteredMap and pmrem.irradianceMap",
      );
    });

    it("should throw when setEnvironmentFromPMREM missing irradianceMap", () => {
      const scene = new Scene();

      expect(() =>
        scene.setEnvironmentFromPMREM({
          prefilteredMap: {} as any,
          irradianceMap: undefined as any,
        } as any),
      ).toThrow(
        "Scene.setEnvironmentFromPMREM() requires pmrem.prefilteredMap and pmrem.irradianceMap",
      );
    });
  });
});
