import path from "node:path";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  css: {
    postcss: path.resolve(root, "postcss.config.mjs"),
  },
  resolve: {
    alias: {
      "@logipay/env": path.resolve(root, "lib/platform/env.ts"),
    },
  },
  plugins: [vinext(), nitro()],
});
