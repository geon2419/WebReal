/**
 * Error class for compute shader related errors.
 * Follows the same pattern as BRDFLutError for consistency.
 */
export class ComputeShaderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ComputeShaderError";
  }
}
