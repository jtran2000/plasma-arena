import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 7000,
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
});
