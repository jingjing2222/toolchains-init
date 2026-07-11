import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

type JsonObject = Record<string, unknown>;

export const tanStackRouter = defineToolchain({
  feature: "router",
  label: "TanStack Router",
  hint: "File-Based Routing or Code-Based Routing",
  catalog: "app",
  order: 10,
  package: "@tanstack/cli",
  command: "create-router",
  subcommand: "create",
  tool: "tanstack-router",
  stackDir: "tanstack-router",
  exportName: "tanStackRouterCliManifest",
  docs: [
    {
      url: "https://raw.githubusercontent.com/TanStack/cli/main/README.md",
      confidence: "medium",
      review: {
        reason:
          "Adapter uses TanStack CLI router-only creation flags and restores unrelated package.json changes.",
        files: ["src/stacks/tanstack-router/adapter.ts", "src/stacks/tanstack-router/init.test.ts"],
        sections: ["Quick Start"],
        mustContain: ["@tanstack/cli", "--router-only"],
        checks: [
          "Confirm router-only creation remains supported by `@tanstack/cli create`.",
          "Confirm package manager, install, git, examples, and toolchain flags still preserve this adapter flow.",
          "Confirm restoring package.json while keeping dependency additions is still necessary.",
        ],
      },
    },
  ],
  managedCli: {
    phase: "run",
    setup: {
      "router-mode": {
        description: "Choose file-based or code-based routing (code mode remains interactive).",
        option: "routerMode",
        type: "enum",
        values: ["file", "code"],
      },
    },
    locked({ packageManager, options, yes }) {
      const invariants = {
        routerOnly: true,
        targetDir: ".",
        force: true,
        noInstall: true,
        noGit: true,
        noToolchain: true,
        noExamples: true,
        noIntent: true,
        packageManager,
      };
      return yes && options.routerMode === "file"
        ? { ...invariants, framework: "React", yes: true }
        : { ...invariants, interactive: true };
    },
    blocked: {
      addOnConfig: "Add-on configuration is unavailable in router-only initialization.",
      addOns: "Start-dependent add-ons are unavailable in router-only initialization.",
      addonDetails: "Add-on inspection does not create the managed router project.",
      deployment: "Deployment adapters are unavailable in router-only initialization.",
      devWatch: "Development watchers must not run during initialization.",
      examples: "Examples are disabled for router-only initialization.",
      git: "Git initialization is owned by the target repository.",
      intent: "TanStack Start intent selection is disabled for router-only initialization.",
      interactive: "Router interaction is controlled by the selected router mode.",
      json: "JSON output does not create the managed router project.",
      listAddOns: "Add-on listing does not create the managed router project.",
      nonInteractive: "Router interaction is controlled by the selected router mode.",
      runDev: "Starting a development server is outside initialization.",
      starter: "Starter selection is unavailable in router-only initialization.",
      template: "Template selection is unavailable in router-only initialization.",
      templateId: "Template selection is unavailable in router-only initialization.",
      toolchain: "Additional toolchain setup is managed by toolchains-init selections.",
      yes: "Use the global --yes option to select unattended initialization.",
    },
    async execute({ cwd, command, yes }) {
      const packageJsonBefore = await readPackageJson(cwd);
      await runCommand(cwd, command.bin, command.args, { stdin: yes ? "ignore" : "inherit" });
      if (packageJsonBefore != null) {
        await restorePackageJsonWithDependencyChanges(cwd, packageJsonBefore);
      }
    },
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
