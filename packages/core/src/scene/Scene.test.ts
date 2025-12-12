import { describe, it, expect } from "bun:test";
import { Scene } from "./Scene";
import { Object3D } from "./Object3D";
import { Mesh } from "./Mesh";
import { DirectionalLight } from "../light/DirectionalLight";
import { PointLight } from "../light/PointLight";
import { BoxGeometry } from "../geometry/BoxGeometry";
import { BasicMaterial } from "../material/BasicMaterial";
import { Color, Vector3 } from "@web-real/math";

describe("Scene", () => {
  describe("constructor", () => {
    it("should create a scene that extends Object3D", () => {
      const scene = new Scene();

      expect(scene).toBeInstanceOf(Object3D);
      expect(scene.position).toBeDefined();
      expect(scene.rotation).toBeDefined();
      expect(scene.scale).toBeDefined();
    });

    it("should have an empty children array by default", () => {
      const scene = new Scene();

      expect(scene.children).toEqual([]);
      expect(scene.children.length).toBe(0);
    });

    it("should be visible by default", () => {
      const scene = new Scene();

      expect(scene.visible).toBe(true);
    });
  });

  describe("add and remove objects", () => {
    it("should add objects to the scene", () => {
      const scene = new Scene();
      const obj1 = new Object3D();
      const obj2 = new Object3D();

      scene.add(obj1).add(obj2);

      expect(scene.children.length).toBe(2);
      expect(scene.children[0]).toBe(obj1);
      expect(scene.children[1]).toBe(obj2);
    });

    it("should remove objects from the scene", () => {
      const scene = new Scene();
      const obj = new Object3D();

      scene.add(obj);
      expect(scene.children.length).toBe(1);

      scene.remove(obj);
      expect(scene.children.length).toBe(0);
    });

    it("should add meshes to the scene", () => {
      const scene = new Scene();
      const geometry = new BoxGeometry();
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);

      scene.add(mesh);

      expect(scene.children.length).toBe(1);
      expect(scene.children[0]).toBe(mesh);
    });

    it("should add lights to the scene", () => {
      const scene = new Scene();
      const light = new DirectionalLight();

      scene.add(light);

      expect(scene.children.length).toBe(1);
      expect(scene.children[0]).toBe(light);
    });
  });

  describe("updateMatrixWorld", () => {
    it("should update world matrices for all objects in the scene", () => {
      const scene = new Scene();
      const obj1 = new Object3D();
      const obj2 = new Object3D();

      obj1.position.x = 10;
      obj2.position.y = 5;

      scene.add(obj1).add(obj2);
      scene.updateMatrixWorld();

      // Verify matrices were updated
      expect(obj1.worldMatrix.data).not.toEqual(new Float32Array(16));
      expect(obj2.worldMatrix.data).not.toEqual(new Float32Array(16));
    });

    it("should update nested object hierarchies", () => {
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

      // All matrices should be updated
      expect(parent.worldMatrix.data).not.toEqual(new Float32Array(16));
      expect(child.worldMatrix.data).not.toEqual(new Float32Array(16));
      expect(grandchild.worldMatrix.data).not.toEqual(new Float32Array(16));
    });

    it("should update mesh transformations", () => {
      const scene = new Scene();
      const geometry = new BoxGeometry();
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);

      mesh.position.x = 5;
      mesh.rotation.y = Math.PI / 4;
      mesh.scale.x = 2;

      scene.add(mesh);
      scene.updateMatrixWorld();

      // Mesh world matrix should reflect transformations
      expect(mesh.worldMatrix.data).not.toEqual(new Float32Array(16));
    });

    it("should handle empty scenes", () => {
      const scene = new Scene();

      // Should not throw
      expect(() => scene.updateMatrixWorld()).not.toThrow();
    });
  });

  describe("findFirstLight", () => {
    it("should find a directional light in the scene", () => {
      const scene = new Scene();
      const light = new DirectionalLight(
        new Vector3(0, -1, 0),
        new Color(1, 1, 1),
        1
      );

      scene.add(light);

      const found = scene.findFirstLight();

      expect(found).toBe(light);
    });

    it("should find a point light in the scene", () => {
      const scene = new Scene();
      const light = new PointLight(new Color(1, 0, 0), 1, 10);

      scene.add(light);

      const found = scene.findFirstLight();

      expect(found).toBe(light);
    });

    describe("environment", () => {
      describe("setEnvironmentFromPMREM", () => {
        it("should throw if prefilteredMap is missing", () => {
          const scene = new Scene();

          expect(() =>
            scene.setEnvironmentFromPMREM({
              prefilteredMap: undefined as any,
              irradianceMap: {} as any,
              brdfLUT: {} as any,
            } as any)
          ).toThrow(
            "Scene.setEnvironmentFromPMREM() requires pmrem.prefilteredMap and pmrem.irradianceMap"
          );
        });

        it("should throw if irradianceMap is missing", () => {
          const scene = new Scene();

          expect(() =>
            scene.setEnvironmentFromPMREM({
              prefilteredMap: {} as any,
              irradianceMap: undefined as any,
              brdfLUT: {} as any,
            } as any)
          ).toThrow(
            "Scene.setEnvironmentFromPMREM() requires pmrem.prefilteredMap and pmrem.irradianceMap"
          );
        });
      });
    });

    it("should return undefined when no lights exist", () => {
      const scene = new Scene();
      const obj = new Object3D();

      scene.add(obj);

      const found = scene.findFirstLight();

      expect(found).toBeUndefined();
    });

    it("should find the first light when multiple lights exist", () => {
      const scene = new Scene();
      const light1 = new DirectionalLight(new Vector3(1, 0, 0));
      const light2 = new DirectionalLight(new Vector3(0, 1, 0));
      const light3 = new PointLight();

      scene.add(light1).add(light2).add(light3);

      const found = scene.findFirstLight();

      // Should find the first light added
      expect(found).toBe(light1);
    });

    it("should find lights in nested hierarchies", () => {
      const scene = new Scene();
      const parent = new Object3D();
      const child = new Object3D();
      const light = new DirectionalLight();

      scene.add(parent);
      parent.add(child);
      child.add(light);

      const found = scene.findFirstLight();

      expect(found).toBe(light);
    });

    it("should filter by DirectionalLight type", () => {
      const scene = new Scene();
      const pointLight = new PointLight();
      const directionalLight = new DirectionalLight();

      scene.add(pointLight).add(directionalLight);

      const found = scene.findFirstLight(DirectionalLight);

      expect(found).toBe(directionalLight);
      expect(found).toBeInstanceOf(DirectionalLight);
    });

    it("should filter by PointLight type", () => {
      const scene = new Scene();
      const directionalLight = new DirectionalLight();
      const pointLight = new PointLight();

      scene.add(directionalLight).add(pointLight);

      const found = scene.findFirstLight(PointLight);

      expect(found).toBe(pointLight);
      expect(found).toBeInstanceOf(PointLight);
    });

    it("should return undefined when type filter doesn't match", () => {
      const scene = new Scene();
      const directionalLight = new DirectionalLight();

      scene.add(directionalLight);

      const found = scene.findFirstLight(PointLight);

      expect(found).toBeUndefined();
    });

    it("should find lights among other objects", () => {
      const scene = new Scene();
      const mesh1 = new Mesh(new BoxGeometry(), new BasicMaterial());
      const obj = new Object3D();
      const light = new PointLight();
      const mesh2 = new Mesh(new BoxGeometry(), new BasicMaterial());

      scene.add(mesh1).add(obj).add(light).add(mesh2);

      const found = scene.findFirstLight();

      expect(found).toBe(light);
    });

    it("should stop searching after finding the first light", () => {
      const scene = new Scene();
      const light1 = new DirectionalLight(new Vector3(1, 0, 0));
      const light2 = new DirectionalLight(new Vector3(0, 1, 0));

      scene.add(light1);
      scene.add(light2);

      const found = scene.findFirstLight();

      // Should return the first one found during traversal
      expect(found).toBe(light1);
    });
  });

  describe("traverse", () => {
    it("should traverse all objects in the scene", () => {
      const scene = new Scene();
      const obj1 = new Object3D();
      const obj2 = new Object3D();
      const obj3 = new Object3D();

      scene.add(obj1).add(obj2);
      obj1.add(obj3);

      const visited: Object3D[] = [];
      scene.traverse((obj) => visited.push(obj));

      expect(visited.length).toBe(4); // scene + 3 objects
      expect(visited[0]).toBe(scene);
      expect(visited).toContain(obj1);
      expect(visited).toContain(obj2);
      expect(visited).toContain(obj3);
    });

    it("should allow modifying objects during traversal", () => {
      const scene = new Scene();
      const obj1 = new Object3D();
      const obj2 = new Object3D();

      scene.add(obj1).add(obj2);

      scene.traverse((obj) => {
        obj.visible = false;
      });

      expect(scene.visible).toBe(false);
      expect(obj1.visible).toBe(false);
      expect(obj2.visible).toBe(false);
    });

    it("should traverse meshes and lights", () => {
      const scene = new Scene();
      const mesh = new Mesh(new BoxGeometry(), new BasicMaterial());
      const light = new DirectionalLight();
      const obj = new Object3D();

      scene.add(mesh).add(light).add(obj);

      const visited: Object3D[] = [];
      scene.traverse((o) => visited.push(o));

      expect(visited.length).toBe(4);
      expect(visited).toContain(mesh);
      expect(visited).toContain(light);
      expect(visited).toContain(obj);
    });
  });

  describe("complex scene hierarchies", () => {
    it("should handle complex object hierarchies", () => {
      const scene = new Scene();
      const root = new Object3D();
      const branch1 = new Object3D();
      const branch2 = new Object3D();
      const leaf1 = new Mesh(new BoxGeometry(), new BasicMaterial());
      const leaf2 = new Mesh(new BoxGeometry(), new BasicMaterial());
      const light = new DirectionalLight();

      scene.add(root);
      root.add(branch1).add(branch2);
      branch1.add(leaf1).add(light);
      branch2.add(leaf2);

      const visited: Object3D[] = [];
      scene.traverse((obj) => visited.push(obj));

      expect(visited.length).toBe(7);
      expect(visited).toContain(scene);
      expect(visited).toContain(root);
      expect(visited).toContain(branch1);
      expect(visited).toContain(branch2);
      expect(visited).toContain(leaf1);
      expect(visited).toContain(leaf2);
      expect(visited).toContain(light);
    });

    it("should update matrices in complex hierarchies", () => {
      const scene = new Scene();
      const parent = new Object3D();
      const child1 = new Object3D();
      const child2 = new Object3D();
      const grandchild = new Object3D();

      parent.position.x = 10;
      child1.position.y = 5;
      child2.position.z = 3;
      grandchild.position.x = 2;

      scene.add(parent);
      parent.add(child1).add(child2);
      child1.add(grandchild);

      scene.updateMatrixWorld();

      // Verify all world matrices are computed
      const allUpdated = [parent, child1, child2, grandchild].every((obj) => {
        return !obj.worldMatrix.data.every((v, i) =>
          i === 0 || i === 5 || i === 10 || i === 15 ? v === 1 : v === 0
        );
      });

      expect(allUpdated).toBe(true);
    });

    it("should find lights in deeply nested hierarchies", () => {
      const scene = new Scene();
      const level1 = new Object3D();
      const level2 = new Object3D();
      const level3 = new Object3D();
      const level4 = new Object3D();
      const light = new PointLight();

      scene.add(level1);
      level1.add(level2);
      level2.add(level3);
      level3.add(level4);
      level4.add(light);

      const found = scene.findFirstLight();

      expect(found).toBe(light);
    });
  });

  describe("edge cases", () => {
    it("should handle adding and removing the same object multiple times", () => {
      const scene = new Scene();
      const obj = new Object3D();

      scene.add(obj);
      scene.add(obj); // Should do nothing or replace
      expect(scene.children.length).toBe(1);

      scene.remove(obj);
      expect(scene.children.length).toBe(0);

      scene.remove(obj); // Should do nothing
      expect(scene.children.length).toBe(0);
    });

    it("should handle empty scene traversal", () => {
      const scene = new Scene();

      const visited: Object3D[] = [];
      scene.traverse((obj) => visited.push(obj));

      expect(visited.length).toBe(1);
      expect(visited[0]).toBe(scene);
    });

    it("should handle scene with only lights", () => {
      const scene = new Scene();
      const light1 = new DirectionalLight();
      const light2 = new PointLight();

      scene.add(light1).add(light2);

      expect(scene.children.length).toBe(2);

      const found = scene.findFirstLight();
      expect(found).toBe(light1);
    });

    it("should handle scene with only meshes", () => {
      const scene = new Scene();
      const mesh1 = new Mesh(new BoxGeometry(), new BasicMaterial());
      const mesh2 = new Mesh(new BoxGeometry(), new BasicMaterial());

      scene.add(mesh1).add(mesh2);

      expect(scene.children.length).toBe(2);

      const light = scene.findFirstLight();
      expect(light).toBeUndefined();
    });

    it("should maintain scene state after matrix updates", () => {
      const scene = new Scene();
      const obj = new Object3D();

      scene.add(obj);
      obj.position.x = 10;

      scene.updateMatrixWorld();

      // Scene should still contain the object
      expect(scene.children.length).toBe(1);
      expect(scene.children[0]).toBe(obj);
    });

    it("should handle invisible objects", () => {
      const scene = new Scene();
      const obj1 = new Object3D();
      const obj2 = new Object3D();

      obj1.visible = false;
      obj2.visible = true;

      scene.add(obj1).add(obj2);

      // Traverse should still visit invisible objects
      const visited: Object3D[] = [];
      scene.traverse((obj) => visited.push(obj));

      expect(visited).toContain(obj1);
      expect(visited).toContain(obj2);
    });
  });
});
