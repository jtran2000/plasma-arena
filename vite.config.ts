import { defineConfig } from "vite";

export default defineConfig({
  base: "/plasma-arena/",
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 7000,
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
});
