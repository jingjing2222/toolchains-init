import { defineConfig } from "tsdown";
import fs from "node:fs/promises";
import path from "node:path";

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
  exports: {
    customExports(exports) {
      return {
        ...exports,
        "./stacks/*/manifest.generated.json": "./dist/stacks/*/manifest.generated.json",
      };
    },
  },
  format: "esm",
  hooks: {
    async "build:done"() {
      await copyGeneratedManifests();
    },
  },
  outDir: "dist",
  platform: "node",
  target: "node20",
});

async function copyGeneratedManifests() {
  const stacksDir = path.resolve("src", "stacks");
  for (const stack of await fs.readdir(stacksDir, { withFileTypes: true })) {
    if (!stack.isDirectory()) {
      continue;
    }

    const source = path.join(stacksDir, stack.name, "manifest.generated.json");
    const target = path.resolve("dist", "stacks", stack.name, "manifest.generated.json");
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(source, target);
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
