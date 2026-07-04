import fs from "node:fs/promises";
import path from "node:path";
import type { PackageJson, ToolchainOptions } from "./types";
import { getSelectedToolchains } from "../stacks";
import { updatePackageJson } from "./package-json";

export async function readPackageJson(cwd: string): Promise<PackageJson | null> {
  try {
    const raw = await fs.readFile(path.join(cwd, "package.json"), "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

export async function existingTargetFiles(cwd: string, options: ToolchainOptions) {
  const files = [
    ...new Set(
      getSelectedToolchains(options.features).flatMap(
        (toolchain) => toolchain.targetFiles?.(options) ?? [],
      ),
    ),
  ];
  const existing: string[] = [];

  for (const file of files) {
    try {
      await fs.access(path.join(cwd, file));
      existing.push(file);
    } catch {}
  }

  return existing;
}

export async function writeToolchain(
  cwd: string,
  packageJson: PackageJson,
  options: ToolchainOptions,
) {
  const nextPackageJson = updatePackageJson(packageJson, options);
  await writeJson(path.join(cwd, "package.json"), nextPackageJson);

  for (const toolchain of getSelectedToolchains(options.features)) {
    await toolchain.afterWrite?.({ cwd, options });
  }
}

async function writeJson(file: string, value: unknown) {
  await writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(file: string, content: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content.trimStart());
}
