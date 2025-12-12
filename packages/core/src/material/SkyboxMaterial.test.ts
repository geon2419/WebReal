import { describe, it, expect } from "bun:test";

import { SkyboxMaterial } from "./SkyboxMaterial";
import type { Texture } from "../texture";
import type { CubeTexture } from "../texture/CubeTexture";

describe("SkyboxMaterial", () => {
  describe("bindingRevision", () => {
    it("should start at 0", () => {
      const material = new SkyboxMaterial();
      expect(material.bindingRevision).toBe(0);
    });

    it("should bump when switching to equirectangular map", () => {
      const material = new SkyboxMaterial();
      const tex1 = {} as unknown as Texture;

      material.setEquirectangularMap(tex1);
      expect(material.bindingRevision).toBe(1);
    });

    it("should not bump when setting same equirectangular texture again", () => {
      const material = new SkyboxMaterial();
      const tex1 = {} as unknown as Texture;

      material.setEquirectangularMap(tex1);
      const rev = material.bindingRevision;
      material.setEquirectangularMap(tex1);
      expect(material.bindingRevision).toBe(rev);
    });

    it("should bump when changing equirectangular texture object", () => {
      const material = new SkyboxMaterial();
      const tex1 = {} as unknown as Texture;
      const tex2 = {} as unknown as Texture;

      material.setEquirectangularMap(tex1);
      const rev1 = material.bindingRevision;

      material.setEquirectangularMap(tex2);
      expect(material.bindingRevision).toBe(rev1 + 1);
    });

    it("should bump when switching to cube map", () => {
      const material = new SkyboxMaterial();
      const cube1 = {} as unknown as CubeTexture;

      material.setCubeMap(cube1);
      expect(material.bindingRevision).toBe(1);
    });

    it("should not bump when setting same cube texture again", () => {
      const material = new SkyboxMaterial();
      const cube1 = {} as unknown as CubeTexture;

      material.setCubeMap(cube1);
      const rev = material.bindingRevision;
      material.setCubeMap(cube1);
      expect(material.bindingRevision).toBe(rev);
    });

    it("should bump when switching modes (equirect -> cube)", () => {
      const material = new SkyboxMaterial();
      const tex1 = {} as unknown as Texture;
      const cube1 = {} as unknown as CubeTexture;

      material.setEquirectangularMap(tex1);
      const rev1 = material.bindingRevision;

      material.setCubeMap(cube1);
      expect(material.bindingRevision).toBe(rev1 + 1);
    });

    it("should bump when switching modes (cube -> equirect)", () => {
      const material = new SkyboxMaterial();
      const tex1 = {} as unknown as Texture;
      const cube1 = {} as unknown as CubeTexture;

      material.setCubeMap(cube1);
      const rev1 = material.bindingRevision;

      material.setEquirectangularMap(tex1);
      expect(material.bindingRevision).toBe(rev1 + 1);
    });

    it("invalidateBindings should bump revision", () => {
      const material = new SkyboxMaterial();
      const rev1 = material.bindingRevision;
      material.invalidateBindings();
      expect(material.bindingRevision).toBe(rev1 + 1);
    });
  });
});
