import path from "node:path";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const d1 = "DB";
const r2 = "DOCUMENTS";
const isVercelPlatform =
  process.env.LOGIPAY_PLATFORM === "vercel" || process.env.VERCEL === "1";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const plugins: unknown[] = [vinext()];

  if (isVercelPlatform) {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro());
  } else {
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    );
  }

  return {
    css: {
      postcss: path.resolve(root, "postcss.config.mjs"),
    },
    resolve: {
      alias: {
        "@logipay/env": path.resolve(
          root,
          isVercelPlatform ? "lib/platform/env.vercel.ts" : "lib/platform/env.cloudflare.ts",
        ),
      },
    },
    plugins,
  };
});
