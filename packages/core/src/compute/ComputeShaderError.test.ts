import { describe, it, expect } from "bun:test";
import { ComputeShaderError } from "./ComputeShaderError";

describe("ComputeShaderError", () => {
  describe("constructor", () => {
    it("should create an error with the correct message", () => {
      const error = new ComputeShaderError("Test error message");
      expect(error.message).toBe("Test error message");
    });

    it("should have the correct name property", () => {
      const error = new ComputeShaderError("Test error");
      expect(error.name).toBe("ComputeShaderError");
    });

    it("should be an instance of Error", () => {
      const error = new ComputeShaderError("Test error");
      expect(error).toBeInstanceOf(Error);
    });

    it("should be an instance of ComputeShaderError", () => {
      const error = new ComputeShaderError("Test error");
      expect(error).toBeInstanceOf(ComputeShaderError);
    });
  });

  describe("cause", () => {
    it("should store the cause when provided", () => {
      const originalError = new Error("Original error");
      const error = new ComputeShaderError("Wrapper error", originalError);

      expect(error.cause).toBe(originalError);
    });

    it("should have undefined cause when not provided", () => {
      const error = new ComputeShaderError("Test error");
      expect(error.cause).toBeUndefined();
    });

    it("should accept any type as cause", () => {
      const stringCause = new ComputeShaderError("Error", "string cause");
      expect(stringCause.cause).toBe("string cause");

      const objectCause = new ComputeShaderError("Error", { code: 123 });
      expect(objectCause.cause).toEqual({ code: 123 });

      const numberCause = new ComputeShaderError("Error", 42);
      expect(numberCause.cause).toBe(42);
    });
  });

  describe("error chaining", () => {
    it("should support nested error chaining", () => {
      const rootCause = new Error("Root cause");
      const middleError = new ComputeShaderError("Middle error", rootCause);
      const topError = new ComputeShaderError("Top error", middleError);

      expect(topError.cause).toBe(middleError);
      expect((topError.cause as ComputeShaderError).cause).toBe(rootCause);
    });
  });

  describe("throwing and catching", () => {
    it("should be throwable and catchable", () => {
      expect(() => {
        throw new ComputeShaderError("Thrown error");
      }).toThrow(ComputeShaderError);
    });

    it("should preserve message when thrown", () => {
      try {
        throw new ComputeShaderError("Specific error message");
      } catch (error) {
        expect(error).toBeInstanceOf(ComputeShaderError);
        expect((error as ComputeShaderError).message).toBe(
          "Specific error message",
        );
      }
    });
  });
});
