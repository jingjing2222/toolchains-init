import fs from "node:fs/promises";
import path from "node:path";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

type JsonObject = Record<string, unknown>;

export const tanStackRouter = defineToolchain({
  feature: "router",
  label: "TanStack Router",
  hint: "File-Based Routing or Code-Based Routing",
  order: 10,
  package: "@tanstack/cli",
  command: "create-router",
  subcommand: "create",
  tool: "tanstack-router",
  stackDir: "tanstack-router",
  exportName: "tanStackRouterCliManifest",
  async run({ cwd, packageManager, options, yes }) {
    const { tanStackRouterCliManifest } = await import("./manifest");
    const command = resolveCliCommand(
      tanStackRouterCliManifest,
      "create-router",
      packageManager,
      yes && options.routerMode === "file"
        ? {
            routerOnly: true,
            targetDir: ".",
            force: true,
            noInstall: true,
            noGit: true,
            noToolchain: true,
            noExamples: true,
            noIntent: true,
            packageManager,
            framework: "React",
            yes: true,
          }
        : {
            routerOnly: true,
            targetDir: ".",
            force: true,
            noInstall: true,
            noGit: true,
            noToolchain: true,
            noExamples: true,
            noIntent: true,
            packageManager,
            interactive: true,
          },
    );

    const packageJsonBefore = await readPackageJson(cwd);

    await runCommand(cwd, command.bin, command.args);

    if (packageJsonBefore != null) {
      await restorePackageJsonWithDependencyChanges(cwd, packageJsonBefore);
    }
  },
});

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
