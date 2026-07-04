import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "../core/run-command";
import type { ToolchainAdapter } from "../core/toolchain-adapter";

type JsonObject = Record<string, unknown>;

export const tanStackRouter: ToolchainAdapter = {
  feature: "router",
  label: "TanStack Router",
  hint: "File-Based Routing or Code-Based Routing",
  async run({ cwd, packageManager, options, yes }) {
    const baseArgs = [
      "create",
      "--router-only",
      "--target-dir",
      ".",
      "--force",
      "--no-install",
      "--no-git",
      "--no-toolchain",
      "--no-examples",
      "--no-intent",
      "--package-manager",
      packageManager,
    ];
    const args =
      yes && options.routerMode === "file"
        ? [...baseArgs, "--framework", "React", "--yes"]
        : [...baseArgs, "--interactive"];

    const command =
      packageManager === "npm"
        ? { bin: "npx", args: ["@tanstack/cli", ...args] }
        : packageManager === "pnpm"
          ? { bin: "pnpm", args: ["dlx", "@tanstack/cli", ...args] }
          : { bin: "yarn", args: ["dlx", "@tanstack/cli", ...args] };

    const packageJsonBefore = await readPackageJson(cwd);

    await runCommand(cwd, command.bin, command.args);

    if (packageJsonBefore != null) {
      await restorePackageJsonWithDependencyChanges(cwd, packageJsonBefore);
    }
  },
};

export async function restorePackageJsonWithDependencyChanges(
  cwd: string,
  packageJsonBefore: JsonObject,
) {
  const packageJsonAfter = await readPackageJson(cwd);
  if (packageJsonAfter == null) {
    return;
  }

  await writePackageJson(cwd, mergeDependencyChanges(packageJsonBefore, packageJsonAfter));
}

export function mergeDependencyChanges(
  packageJsonBefore: JsonObject,
  packageJsonAfter: JsonObject,
) {
  const next = { ...packageJsonBefore };
  const dependencies = mergeAddedDependencies(
    packageJsonBefore.dependencies,
    packageJsonAfter.dependencies,
  );
  const devDependencies = mergeAddedDependencies(
    packageJsonBefore.devDependencies,
    packageJsonAfter.devDependencies,
  );

  if (dependencies != null) {
    next.dependencies = dependencies;
  }
  if (devDependencies != null) {
    next.devDependencies = devDependencies;
  }

  return next;
}

async function readPackageJson(cwd: string): Promise<JsonObject | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf8")) as JsonObject;
  } catch {
    return null;
  }
}

async function writePackageJson(cwd: string, packageJson: JsonObject) {
  await fs.writeFile(path.join(cwd, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
}

function mergeAddedDependencies(before: unknown, after: unknown) {
  if (!isJsonObject(before) && !isJsonObject(after)) {
    return null;
  }

  const next = isJsonObject(before) ? { ...before } : {};
  if (!isJsonObject(after)) {
    return next;
  }

  for (const [name, version] of Object.entries(after)) {
    next[name] ??= version;
  }

  return next;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value != null && !Array.isArray(value);
}
