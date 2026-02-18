import { describe, it, expect } from "bun:test";
import { Color } from "@web-real/math";
import { PointLight } from "./PointLight";

describe("PointLight", () => {
  describe("constructor", () => {
    it("should initialize with default values (white color, intensity 1, range 10, quadratic attenuation)", () => {
      const light = new PointLight();
      expect(light.color.r).toBe(1);
      expect(light.color.g).toBe(1);
      expect(light.color.b).toBe(1);
      expect(light.intensity).toBe(1);
      expect(light.range).toBe(10);
      expect(light.attenuationType).toBe("quadratic");
    });

    it("should initialize with given color and default other parameters", () => {
      const color = new Color(0.5, 0.3, 0.8);
      const light = new PointLight(color);
      expect(light.color.r).toBe(0.5);
      expect(light.color.g).toBe(0.3);
      expect(light.color.b).toBe(0.8);
      expect(light.intensity).toBe(1);
      expect(light.range).toBe(10);
      expect(light.attenuationType).toBe("quadratic");
    });

    it("should initialize with color and intensity", () => {
      const color = new Color(0.5, 0.3, 0.8);
      const light = new PointLight(color, 2.5);
      expect(light.color.r).toBe(0.5);
      expect(light.color.g).toBe(0.3);
      expect(light.color.b).toBe(0.8);
      expect(light.intensity).toBe(2.5);
      expect(light.range).toBe(10);
      expect(light.attenuationType).toBe("quadratic");
    });

    it("should initialize with all parameters", () => {
      const color = new Color(0.2, 0.4, 0.6);
      const light = new PointLight(color, 3.0, 25, "linear");
      expect(light.color.r).toBe(0.2);
      expect(light.color.g).toBe(0.4);
      expect(light.color.b).toBe(0.6);
      expect(light.intensity).toBe(3.0);
      expect(light.range).toBe(25);
      expect(light.attenuationType).toBe("linear");
    });

    it("should initialize with physical attenuation type", () => {
      const light = new PointLight(new Color(1, 1, 1), 1, 10, "physical");
      expect(light.attenuationType).toBe("physical");
    });
  });

  describe("range property", () => {
    it("should allow range to be modified", () => {
      const light = new PointLight();
      light.range = 50;
      expect(light.range).toBe(50);
    });

    it("should handle zero range", () => {
      const light = new PointLight(new Color(1, 1, 1), 1, 0);
      expect(light.range).toBe(0);
    });

    it("should handle very large range values", () => {
      const light = new PointLight(new Color(1, 1, 1), 1, 1000);
      expect(light.range).toBe(1000);
    });

    it("should handle very small range values", () => {
      const light = new PointLight(new Color(1, 1, 1), 1, 0.1);
      expect(light.range).toBe(0.1);
    });
  });

  describe("attenuationType property", () => {
    it("should allow attenuation type to be modified", () => {
      const light = new PointLight();
      light.attenuationType = "linear";
      expect(light.attenuationType).toBe("linear");
    });

    it("should allow changing between all attenuation types", () => {
      const light = new PointLight();

      light.attenuationType = "linear";
      expect(light.attenuationType).toBe("linear");

      light.attenuationType = "quadratic";
      expect(light.attenuationType).toBe("quadratic");

      light.attenuationType = "physical";
      expect(light.attenuationType).toBe("physical");
    });
  });

  describe("getAttenuationFactors", () => {
    describe("linear attenuation", () => {
      it("should return correct factors for linear attenuation", () => {
        const light = new PointLight(new Color(1, 1, 1), 1, 10, "linear");
        const factors = light.getAttenuationFactors();
        expect(factors).toEqual([10, 0, 0, 0]);
      });

      it("should update factors when range changes", () => {
        const light = new PointLight(new Color(1, 1, 1), 1, 10, "linear");
        light.range = 20;
        const factors = light.getAttenuationFactors();
        expect(factors[0]).toBe(20);
        expect(factors[3]).toBe(0); // type code for linear
      });
    });

    describe("quadratic attenuation", () => {
      it("should return correct factors for quadratic attenuation", () => {
        const light = new PointLight(new Color(1, 1, 1), 1, 15, "quadratic");
        const factors = light.getAttenuationFactors();
        expect(factors).toEqual([15, 0, 0, 1]);
      });

      it("should update factors when range changes", () => {
        const light = new PointLight(new Color(1, 1, 1), 1, 10, "quadratic");
        light.range = 30;
        const factors = light.getAttenuationFactors();
        expect(factors[0]).toBe(30);
        expect(factors[3]).toBe(1); // type code for quadratic
      });
    });

    describe("physical attenuation", () => {
      it("should return correct factors for physical attenuation", () => {
        const light = new PointLight(new Color(1, 1, 1), 1, 10, "physical");
        const factors = light.getAttenuationFactors();
        expect(factors).toEqual([10, 16, 0, 2]);
      });

      it("should update factors when range changes", () => {
        const light = new PointLight(new Color(1, 1, 1), 1, 10, "physical");
        light.range = 25;
        const factors = light.getAttenuationFactors();
        expect(factors[0]).toBe(25);
        expect(factors[1]).toBe(16); // k parameter
        expect(factors[3]).toBe(2); // type code for physical
      });

      it("should always use k=16 for physical attenuation", () => {
        const light = new PointLight(new Color(1, 1, 1), 1, 5, "physical");
        const factors = light.getAttenuationFactors();
        expect(factors[1]).toBe(16);
      });
    });

    describe("type code consistency", () => {
      it("should return consistent type codes", () => {
        const linearLight = new PointLight(new Color(1, 1, 1), 1, 10, "linear");
        const quadraticLight = new PointLight(
          new Color(1, 1, 1),
          1,
          10,
          "quadratic",
        );
        const physicalLight = new PointLight(
          new Color(1, 1, 1),
          1,
          10,
          "physical",
        );

        expect(linearLight.getAttenuationFactors()[3]).toBe(0);
        expect(quadraticLight.getAttenuationFactors()[3]).toBe(1);
        expect(physicalLight.getAttenuationFactors()[3]).toBe(2);
      });

      it("should update type code when attenuation type changes", () => {
        const light = new PointLight();

        light.attenuationType = "linear";
        expect(light.getAttenuationFactors()[3]).toBe(0);

        light.attenuationType = "quadratic";
        expect(light.getAttenuationFactors()[3]).toBe(1);

        light.attenuationType = "physical";
        expect(light.getAttenuationFactors()[3]).toBe(2);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle zero intensity", () => {
      const light = new PointLight(new Color(1, 1, 1), 0, 10);
      expect(light.intensity).toBe(0);
    });

    it("should handle negative intensity", () => {
      const light = new PointLight(new Color(1, 1, 1), -0.5, 10);
      expect(light.intensity).toBe(-0.5);
    });

    it("should handle very high intensity values", () => {
      const light = new PointLight(new Color(1, 1, 1), 1000, 10);
      expect(light.intensity).toBe(1000);
    });

    it("should work with black color", () => {
      const light = new PointLight(new Color(0, 0, 0), 1, 10);
      expect(light.color.r).toBe(0);
      expect(light.color.g).toBe(0);
      expect(light.color.b).toBe(0);
    });

    it("should work with HDR color values", () => {
      const light = new PointLight(new Color(2, 3, 4), 1, 10);
      expect(light.color.r).toBe(2);
      expect(light.color.g).toBe(3);
      expect(light.color.b).toBe(4);
    });
  });

  describe("inheritance from Light", () => {
    it("should inherit color and intensity properties", () => {
      const light = new PointLight();
      expect(light.color).toBeDefined();
      expect(light.intensity).toBeDefined();
    });

    it("should allow inherited properties to be modified", () => {
      const light = new PointLight();
      light.color = new Color(0.1, 0.2, 0.3);
      light.intensity = 5.0;
      expect(light.color.r).toBe(0.1);
      expect(light.color.g).toBe(0.2);
      expect(light.color.b).toBe(0.3);
      expect(light.intensity).toBe(5.0);
    });
  });

  describe("inheritance from Object3D", () => {
    it("should inherit position property for light placement", () => {
      const light = new PointLight();
      light.position.x = 5;
      light.position.y = 10;
      light.position.z = 15;
      expect(light.position.x).toBe(5);
      expect(light.position.y).toBe(10);
      expect(light.position.z).toBe(15);
    });

    it("should have visible property", () => {
      const light = new PointLight();
      expect(light.visible).toBe(true);
      light.visible = false;
      expect(light.visible).toBe(false);
    });
  });
});
