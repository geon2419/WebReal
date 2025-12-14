import { describe, it, expect } from "bun:test";
import { Mesh } from "./Mesh";
import { BoxGeometry } from "../geometry/BoxGeometry";
import { BasicMaterial } from "../material/BasicMaterial";
import { VertexColorMaterial } from "../material/VertexColorMaterial";
import { BoundingBox } from "@web-real/math";

describe("Mesh", () => {
  describe("constructor and basic properties", () => {
    it("should create mesh with geometry and material", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);

      expect(mesh.geometry).toBe(geometry);
      expect(mesh.material).toBe(material);
      expect(mesh.needsUpdate).toBe(false);
    });
  });

  describe("geometry setter", () => {
    it("should invalidate caches and set needsUpdate when changed", () => {
      const geometry1 = new BoxGeometry(2, 2, 2);
      const geometry2 = new BoxGeometry(4, 4, 4);
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry1, material);

      const bbox1 = mesh.boundingBox;
      mesh.needsUpdate = false;

      mesh.geometry = geometry2;

      expect(mesh.boundingBox).not.toBe(bbox1);
      expect(mesh.needsUpdate).toBe(true);
    });
  });

  describe("material setter", () => {
    it("should invalidate interleaved vertices cache and set needsUpdate", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material1 = new BasicMaterial();
      const material2 = new VertexColorMaterial({
        colors: new Float32Array(geometry.vertexCount * 3),
      });
      const mesh = new Mesh(geometry, material1);

      const data1 = mesh.getInterleavedVertices();
      mesh.needsUpdate = false;

      mesh.material = material2;

      const data2 = mesh.getInterleavedVertices();
      expect(data2).not.toBe(data1); // Different cached instance
      expect(mesh.needsUpdate).toBe(true);
    });
  });

  describe("boundingBox", () => {
    it("should compute, cache, and recompute on geometry change", () => {
      const geometry1 = new BoxGeometry(2, 2, 2);
      const geometry2 = new BoxGeometry(10, 10, 10);
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry1, material);

      const bbox1 = mesh.boundingBox;
      expect(bbox1).toBeInstanceOf(BoundingBox);

      const bbox1Again = mesh.boundingBox;
      expect(bbox1Again).toBe(bbox1);

      mesh.geometry = geometry2;
      const bbox2 = mesh.boundingBox;

      expect(bbox2).not.toBe(bbox1);
      expect(bbox2.getSize().length).toBeGreaterThan(bbox1.getSize().length);
    });
  });

  describe("getWireframeIndices", () => {
    it("should convert triangles to line segments correctly", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);

      const wireframe = mesh.getWireframeIndices();
      const triangleIndices = geometry.indices;

      expect(wireframe.length).toBe((triangleIndices.length / 3) * 6);

      // Verify first triangle: [a,b,c] -> [a,b, b,c, c,a]
      expect(wireframe[0]).toBe(triangleIndices[0]);
      expect(wireframe[1]).toBe(triangleIndices[1]);
      expect(wireframe[2]).toBe(triangleIndices[1]);
      expect(wireframe[3]).toBe(triangleIndices[2]);
      expect(wireframe[4]).toBe(triangleIndices[2]);
      expect(wireframe[5]).toBe(triangleIndices[0]);
    });

    it("should preserve index array type", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);

      const wireframe = mesh.getWireframeIndices();
      const isUint16 = geometry.indices instanceof Uint16Array;

      expect(wireframe).toBeInstanceOf(isUint16 ? Uint16Array : Uint32Array);
    });
  });

  describe("getInterleavedVertices", () => {
    it("should interleave position and normal for basic material", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);

      const data = mesh.getInterleavedVertices();

      expect(data.length).toBe(geometry.vertexCount * 6);
      expect(data[0]).toBe(geometry.positions[0]);
      expect(data[3]).toBe(geometry.normals[0]);
    });

    it("should interleave position and color for vertex color material", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const colors = new Float32Array(geometry.vertexCount * 3);
      colors[0] = 1;
      colors[1] = 0.5;
      colors[2] = 0.25;
      const material = new VertexColorMaterial({ colors });
      const mesh = new Mesh(geometry, material);

      const data = mesh.getInterleavedVertices();

      expect(data.length).toBe(geometry.vertexCount * 6);
      expect(data[3]).toBe(1);
      expect(data[4]).toBe(0.5);
      expect(data[5]).toBe(0.25);
    });

    it("should return positions only for line material", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = { type: "line" } as any;
      const mesh = new Mesh(geometry, material);

      const data = mesh.getInterleavedVertices();
      expect(data.length).toBe(geometry.positions.length);
      expect(data[0]).toBe(geometry.positions[0]);
      // Should be a copy, not the same reference
      expect(data).not.toBe(geometry.positions);
    });

    it("should cache interleaved vertices", () => {
      const geometry = new BoxGeometry(2, 2, 2);
      const material = new BasicMaterial();
      const mesh = new Mesh(geometry, material);

      const data1 = mesh.getInterleavedVertices();
      const data2 = mesh.getInterleavedVertices();

      expect(data1).toBe(data2);
    });

    it("should throw if texture material lacks UV coordinates", () => {
      const geometry = {
        positions: new Float32Array([0, 0, 0]),
        normals: new Float32Array([0, 0, 1]),
        uvs: undefined,
        indices: new Uint16Array([0]),
        vertexCount: 1,
        indexCount: 1,
      } as any;
      const material = { type: "texture" } as any;
      const mesh = new Mesh(geometry, material);

      expect(() => mesh.getInterleavedVertices()).toThrow(
        "texture material requires geometry with UV coordinates"
      );
    });

    it("should throw if parallax material lacks tangents or bitangents", () => {
      const geometry = {
        positions: new Float32Array([0, 0, 0]),
        normals: new Float32Array([0, 0, 1]),
        uvs: new Float32Array([0, 0]),
        tangents: undefined,
        bitangents: undefined,
        indices: new Uint16Array([0]),
        vertexCount: 1,
        indexCount: 1,
      } as any;
      const material = { type: "parallax" } as any;
      const mesh = new Mesh(geometry, material);

      expect(() => mesh.getInterleavedVertices()).toThrow(
        "parallax material requires geometry with tangents and bitangents"
      );
    });
  });
});
