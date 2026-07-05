import { getCliCommandManifest, getSelectedToolchains } from "../stacks";
import { getToolchainCliTool } from "./toolchain-adapter";
import type { Feature, PackageJson, ToolchainOptions } from "./types";
import { DEFAULT_ROUTER_MODE } from "./types";

export function updatePackageJson(
  packageJson: PackageJson,
  optionsOrFeatures: ToolchainOptions | Feature[],
): PackageJson {
  return updatePackageJsonForLifecycle(packageJson, optionsOrFeatures, "updatePackageJson");
}

export function updatePackageJsonBeforeRun(
  packageJson: PackageJson,
  optionsOrFeatures: ToolchainOptions | Feature[],
): PackageJson {
  return updatePackageJsonForLifecycle(packageJson, optionsOrFeatures, "beforeRun");
}

function updatePackageJsonForLifecycle(
  packageJson: PackageJson,
  optionsOrFeatures: ToolchainOptions | Feature[],
  lifecycle: "beforeRun" | "updatePackageJson",
): PackageJson {
  const options = Array.isArray(optionsOrFeatures)
    ? { features: optionsOrFeatures, routerMode: DEFAULT_ROUTER_MODE }
    : optionsOrFeatures;
  const next: PackageJson = structuredClone(packageJson);
  next.scripts = { ...next.scripts };
  next.dependencies = { ...next.dependencies };
  next.devDependencies = { ...next.devDependencies };

  for (const toolchain of getSelectedToolchains(options.features)) {
    toolchain[lifecycle]?.({
      cliManifest: getCliManifestForToolchain(toolchain),
      packageJson: next,
      options,
    });
  }

  sortObject(next.scripts);
  sortObject(next.dependencies);
  sortObject(next.devDependencies);
  return next;
}

function getCliManifestForToolchain(toolchain: ReturnType<typeof getSelectedToolchains>[number]) {
  return toolchain.cli == null
    ? undefined
    : (getCliCommandManifest(getToolchainCliTool(toolchain)) ?? undefined);
}

function sortObject(object: Record<string, string> | undefined) {
  if (object == null) {
    return;
  }
  const entries = Object.entries(object).sort(([left], [right]) => left.localeCompare(right));
  for (const key of Object.keys(object)) {
    delete object[key];
  }
  for (const [key, value] of entries) {
    object[key] = value;
  }
}
