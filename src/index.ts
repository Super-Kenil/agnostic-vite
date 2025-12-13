import { Plugin, ResolvedConfig } from "vite"
import fs from "fs"
import path from "path"
import process from "process"

type AgnosticViteArgs = {
  assetsDir: string
}

const agnosticVite = (args: AgnosticViteArgs): Plugin => {
  let viteConfig: ResolvedConfig

  const getDevScript = (host: string) => `
    const IS_DEV = true;
    const VITE_HOST = "${host}";
    
    // In Dev, we just point to the Vite Server
    window.viteAsset = (entry) => {
        const isJS = entry.endsWith(".js");
        const isCSS = entry.endsWith(".css");
        
        if (isJS) {
            const script = document.createElement("script");
            script.type = "module";
            script.src = VITE_HOST + "/" + entry;
             // Inject @vite/client if strictly needed, usually handled by backend helper, 
             // but good safety to add if missing.
            document.body.appendChild(script);
        } else if (isCSS) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = VITE_HOST + "/" + entry;
            document.head.appendChild(link);
        }
    };
    
    // Auto-inject vite client for HMR
    (function() {
        const client = document.createElement("script");
        client.type = "module";
        client.src = VITE_HOST + "/@vite/client";
        document.head.appendChild(client);
    })();
  `

  const getProdScript = (manifestMap: string, outDir: string) => `
    const IS_DEV = false;
    const OUT_DIR = "${outDir}";
    
    // The Manifest is INLINED here. No network fetch needed.
    const _MANIFEST = ${manifestMap};

    function injectLinkTag(href) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = OUT_DIR + "/" + href;
        document.head.appendChild(link);
    }

    function viteAsset(entry) {
        // 1. Try to find exact match
        // 2. Try to find match with assetsDir prefix
        let asset = _MANIFEST[entry];

        if (!asset) {
            console.warn("[agnostic-vite] Asset not found:", entry);
            return;
        }

        // Handle CSS dependencies of this JS entry (if any)
        if (asset.css && asset.css.length) {
            asset.css.forEach(cssFile => injectLinkTag(cssFile));
        }

        // Handle the file itself
        if (entry.endsWith(".js")) {
            const script = document.createElement("script");
            script.type = "module";
            script.src = OUT_DIR + "/" + asset.file;
            document.body.appendChild(script);
        } else if (entry.endsWith(".css")) {
            injectLinkTag(asset.file);
        }
    }

    if (typeof window !== "undefined") {
        window.viteAsset = viteAsset;
    }
  `

  return {
    name: "agnostic-vite",

    configResolved (config: ResolvedConfig) {
      viteConfig = config
    },

    // dev mode
    configureServer (server) {
      const host = viteConfig.server?.host
        ? `http://${viteConfig.server.host}:${viteConfig.server.port}`
        : "http://localhost:5173"

      const devFilePath = path.resolve(
        process.cwd(),
        `${viteConfig.build.outDir}/agnostic-vite-runtime.js`
      )

      fs.mkdirSync(path.dirname(devFilePath), { recursive: true })
      fs.writeFileSync(devFilePath, getDevScript(host), "utf-8")

      console.info(`[agnostic-vite] Dev runtime written to: ${devFilePath}`)
    },

    // build mode
    generateBundle (options, bundle) {
      const manifest: Record<string, any> = {}
      const rootPrefix = args.assetsDir ? args.assetsDir + "/" : ""

      for (const fileName in bundle) {
        const chunk = bundle[fileName]

        if (chunk.type === "chunk" && chunk.isEntry) {
          if (chunk.facadeModuleId) {
            let key = path.relative(process.cwd(), chunk.facadeModuleId)
            key = key.split(path.sep).join("/")
            if (key.startsWith(rootPrefix)) {
              key = key.substring(rootPrefix.length)
            }

            manifest[key] = {
              file: fileName,
              css: chunk.viteMetadata?.importedCss
                ? Array.from(chunk.viteMetadata.importedCss)
                : []
            }
          }
        }

        else if (chunk.type === "asset" && chunk.name && chunk.fileName.endsWith(".css")) {
          let key = chunk.name ? chunk.name : chunk.fileName
          if (!key.endsWith('.css')) key += '.css'

          if (chunk.names && chunk.names.length > 0) {
            chunk.names.forEach(n => {
              manifest[n] = { file: fileName }
              manifest['css/' + n] = { file: fileName }
            })
          } else {
            manifest[chunk.name || fileName] = { file: fileName }
          }
        }
      }

      const outDirBase = viteConfig.build.outDir.split("/").pop() || "dist"
      const scriptContent = getProdScript(JSON.stringify(manifest, null, 2), outDirBase)

      this.emitFile({
        type: "asset",
        fileName: "agnostic-vite-runtime.js",
        source: scriptContent,
      })
    },
  }
}

export default agnosticVite