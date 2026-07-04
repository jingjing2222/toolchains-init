import * as Module from "node:module";
import type { PackageManager } from "./package-manager";

type ModuleWithPnp = typeof Module & {
  findPnpApi?: (cwd: string) => unknown;
};

export function getPnpInfo(cwd = process.cwd()) {
  const runtimePnp = Boolean(process.versions.pnp);
  const projectPnpApi = (Module as ModuleWithPnp).findPnpApi?.(cwd) ?? null;

  return {
    isRuntimePnp: runtimePnp,
    isProjectPnp: Boolean(projectPnpApi),
    pnpApi: projectPnpApi,
  };
}

export function usesYarnPnp(cwd: string, packageManager: PackageManager) {
  return packageManager === "yarn" && getPnpInfo(cwd).isProjectPnp;
}
