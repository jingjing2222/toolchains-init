import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  clean: true,
  deps: {
    alwaysBundle: ["@clack/prompts", "picocolors"],
    onlyBundle: ["@clack/core", "@clack/prompts", "picocolors", "sisteransi"],
  },
  dts: true,
  exports: true,
  format: "esm",
  outDir: "dist",
  platform: "node",
  target: "node20",
});
