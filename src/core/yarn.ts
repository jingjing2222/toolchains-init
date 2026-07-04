import fs from "node:fs";
import * as Module from "node:module";
import path from "node:path";
import type { PackageManager } from "./package-manager";

type ModuleWithPnp = typeof Module & {
  findPnpApi?: (cwd: string) => unknown;
};

export function getPnpInfo(cwd = process.cwd()) {
  const runtimePnp = Boolean(process.versions.pnp);
  const projectPnpApi = findRuntimePnpApi(cwd);
  const pnpArtifactPath = findUp(cwd, [".pnp.cjs", ".pnp.loader.mjs"]);
  const yarnrcPath = findUp(cwd, [".yarnrc.yml"]);
  const nodeLinker = yarnrcPath == null ? null : readNodeLinker(yarnrcPath);

  return {
    isRuntimePnp: runtimePnp,
    isProjectPnp: Boolean(projectPnpApi) || pnpArtifactPath != null || nodeLinker === "pnp",
    nodeLinker,
    pnpArtifactPath,
    pnpApi: projectPnpApi,
  };
}

function findRuntimePnpApi(cwd: string) {
  try {
    return (Module as ModuleWithPnp).findPnpApi?.(cwd) ?? null;
  } catch {
    return null;
  }
}

export function usesYarnPnp(cwd: string, packageManager: PackageManager) {
  if (packageManager !== "yarn") {
    return false;
  }

  const pnpInfo = getPnpInfo(cwd);
  if (pnpInfo.nodeLinker === "node-modules") {
    return false;
  }
  if (pnpInfo.nodeLinker === "pnpm") {
    return false;
  }

  return pnpInfo.isProjectPnp || pnpInfo.nodeLinker == null;
}

function findUp(cwd: string, filenames: string[]) {
  let current = path.resolve(cwd);

  while (true) {
    for (const filename of filenames) {
      const candidate = path.join(current, filename);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function readNodeLinker(yarnrcPath: string) {
  try {
    const content = fs.readFileSync(yarnrcPath, "utf8");
    const match = /^nodeLinker:\s*["']?([^"'\s#]+)["']?/m.exec(content);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
