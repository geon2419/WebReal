import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 3001,
    open: false,
  },
  build: {
    outDir: "dist",
  },
});
