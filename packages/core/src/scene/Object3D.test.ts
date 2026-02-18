import { describe, it, expect } from "bun:test";
import { Object3D } from "./Object3D";
import { Vector3, Matrix4 } from "@web-real/math";

describe("Object3D", () => {
  describe("initialization", () => {
    it("should initialize with identity transform and no hierarchy", () => {
      const obj = new Object3D();

      // Transform properties
      expect(obj.position).toEqual(new Vector3(0, 0, 0));
      expect(obj.rotation).toEqual(new Vector3(0, 0, 0));
      expect(obj.scale).toEqual(new Vector3(1, 1, 1));

      // Hierarchy
      expect(obj.parent).toBe(null);
      expect(obj.children).toEqual([]);

      // Visibility and matrices
      expect(obj.visible).toBe(true);
      expect(obj.localMatrix.data).toEqual(new Matrix4().data);
      expect(obj.worldMatrix.data).toEqual(new Matrix4().data);
    });
  });

  describe("hierarchy management", () => {
    it("should establish parent-child relationships correctly", () => {
      const parent = new Object3D();
      const child1 = new Object3D();
      const child2 = new Object3D();

      parent.add(child1).add(child2);

      expect(parent.children).toEqual([child1, child2]);
      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
    });

    it("should reparent child when added to a new parent", () => {
      const parent1 = new Object3D();
      const parent2 = new Object3D();
      const child = new Object3D();

      parent1.add(child);
      parent2.add(child);

      expect(parent1.children).toEqual([]);
      expect(parent2.children).toEqual([child]);
      expect(child.parent).toBe(parent2);
    });

    it("should remove child and clear parent reference", () => {
      const parent = new Object3D();
      const child = new Object3D();

      parent.add(child);
      parent.remove(child);

      expect(parent.children).toEqual([]);
      expect(child.parent).toBe(null);
    });
  });

  describe("local matrix transformation", () => {
    it("should compute TRS transformation correctly", () => {
      const obj = new Object3D();
      obj.position = new Vector3(10, 5, 0);
      obj.rotation.y = Math.PI / 2;
      obj.scale = new Vector3(2, 1, 1);
      obj.updateMatrix();

      const expected = Matrix4.translation(new Vector3(10, 5, 0))
        .multiply(Matrix4.rotationY(Math.PI / 2))
        .multiply(Matrix4.scaling(new Vector3(2, 1, 1)));

      for (let i = 0; i < 16; i++) {
        expect(obj.localMatrix.data[i]).toBeCloseTo(expected.data[i], 5);
      }
    });

    it("should apply euler rotation in ZYX order", () => {
      const obj = new Object3D();
      obj.rotation = new Vector3(Math.PI / 6, Math.PI / 4, Math.PI / 3);
      obj.updateMatrix();

      const expected = Matrix4.rotationZ(Math.PI / 3)
        .multiply(Matrix4.rotationY(Math.PI / 4))
        .multiply(Matrix4.rotationX(Math.PI / 6));

      for (let i = 0; i < 16; i++) {
        expect(obj.localMatrix.data[i]).toBeCloseTo(expected.data[i], 5);
      }
    });
  });

  describe("world matrix propagation", () => {
    it("should propagate transforms through hierarchy", () => {
      const root = new Object3D();
      const child = new Object3D();
      const grandchild = new Object3D();

      root.position = new Vector3(10, 0, 0);
      child.position = new Vector3(0, 5, 0);
      grandchild.position = new Vector3(0, 0, 3);

      root.add(child);
      child.add(grandchild);
      root.updateWorldMatrix();

      const expectedChild = Matrix4.translation(new Vector3(10, 0, 0)).multiply(
        Matrix4.translation(new Vector3(0, 5, 0)),
      );
      const expectedGrandchild = expectedChild.multiply(
        Matrix4.translation(new Vector3(0, 0, 3)),
      );

      for (let i = 0; i < 16; i++) {
        expect(child.worldMatrix.data[i]).toBeCloseTo(expectedChild.data[i], 5);
        expect(grandchild.worldMatrix.data[i]).toBeCloseTo(
          expectedGrandchild.data[i],
          5,
        );
      }
    });

    it("should respect updateChildren flag", () => {
      const parent = new Object3D();
      const child = new Object3D();

      parent.position = new Vector3(10, 0, 0);
      parent.add(child);
      parent.updateWorldMatrix(false, false);

      expect(parent.worldMatrix.data).not.toEqual(new Matrix4().data);
      expect(child.worldMatrix.data).toEqual(new Matrix4().data);
    });

    it("should update parent chain when updateParents is true", () => {
      const root = new Object3D();
      const child = new Object3D();

      root.position = new Vector3(10, 0, 0);
      root.add(child);
      child.updateWorldMatrix(true, false);

      expect(root.worldMatrix.data).not.toEqual(new Matrix4().data);
    });
  });

  describe("traverse", () => {
    it("should execute callback on entire hierarchy in depth-first order", () => {
      const root = new Object3D();
      const child1 = new Object3D();
      const child2 = new Object3D();
      const grandchild = new Object3D();

      root.add(child1).add(child2);
      child1.add(grandchild);

      const visited: Object3D[] = [];
      root.traverse((obj) => visited.push(obj));

      expect(visited).toEqual([root, child1, grandchild, child2]);
    });
  });

  describe("disposeHierarchy", () => {
    it("should clear parent-child relationships", () => {
      const parent = new Object3D();
      const child = new Object3D();

      parent.add(child);
      child.disposeHierarchy();

      expect(child.parent).toBe(null);
      expect(parent.children).toEqual([]);
    });
  });
});
