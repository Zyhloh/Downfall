import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "./ui"),
      "@src": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "esnext",
  },
});
