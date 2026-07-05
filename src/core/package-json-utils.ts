import type { CliCommandManifest } from "./cli-command-manifest";
import type { PackageJson } from "./types";

export function ensureTypecheckScript(packageJson: PackageJson) {
  setScript(packageJson, "typecheck", "tsc --build");
}

export function setScript(
  packageJson: PackageJson,
  name: string,
  command: string,
  options: { overwrite?: boolean } = {},
) {
  packageJson.scripts ??= {};
  if (options.overwrite === true || packageJson.scripts[name] == null) {
    packageJson.scripts[name] = command;
  }
}

export function setDevDependency(packageJson: PackageJson, name: string, version: string) {
  packageJson.devDependencies ??= {};
  packageJson.devDependencies[name] ??= version;
}

export function setManifestDevDependency(
  packageJson: PackageJson,
  manifest: CliCommandManifest | undefined,
) {
  if (manifest == null) {
    throw new Error("Missing CLI manifest for manifest-backed devDependency");
  }
  packageJson.devDependencies ??= {};
  packageJson.devDependencies[manifest.package] = manifest.version;
}

export function hasPackageDependency(packageJson: PackageJson, name: string) {
  return packageJson.dependencies?.[name] != null || packageJson.devDependencies?.[name] != null;
}
