import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "WebReal3DMath",
      fileName: (format) =>
        format === "es" ? "web-real-math.mjs" : "web-real-math.cjs",
      formats: ["es", "cjs"],
    },
  },
});
