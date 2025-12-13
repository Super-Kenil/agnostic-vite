import { defineConfig } from "vite";
import path from "path";
import { sync } from "glob";
import tailwindcss from "@tailwindcss/vite";
import agnosticVite from "./agnostic-vite.ts";

export default defineConfig((s) => {
  return {
    root: s.mode === "development" ? "public" : ".",
    server: {
      host: "localhost",
      port: "5173",
      strictPort: true,
    },
    plugins: [tailwindcss(), agnosticVite({ assetsDir: "public" })],
    build: {
      outDir: "public/dist", // output dir for production build
      copyPublicDir: false,
      emptyOutDir: true,
      rollupOptions: {
        input: [
          ...sync("public/js/**/*.js").map((file) =>
            path.resolve(__dirname, file)
          ),
          ...sync("public/css/style.css").map((file) =>
            path.resolve(__dirname, file)
          ),
        ],
      },
    },
  };
});
