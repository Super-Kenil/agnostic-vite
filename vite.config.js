import {defineConfig} from 'vite';
import path from 'path';
import {sync} from 'glob';
import tailwindcss from '@tailwindcss/vite'
import {agnosticVite} from "./agnostic-vite.ts";

export default defineConfig((s) => {
    return {
        root: ".",
        base: s.mode === "development"
            ? "/"
            : "/dist/",
        esbuild: {},
        server: {
            strictPort: true
        },
        plugins: [
            tailwindcss(),
            agnosticVite({assetsDir: "./public"}),
        ],
        build: {
            // output dir for production build
            outDir: "public/dist",
            copyPublicDir: false,
            emptyOutDir: false,
            manifest: 'manifest.json',
            rollupOptions: {
                input: [
                    ...sync('public/js/**/*.js').map((file) => path.resolve(__dirname, file)),
                ]
            },
        },
    }
});import path from 'path';
