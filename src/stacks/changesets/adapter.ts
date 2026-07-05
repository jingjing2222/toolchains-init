import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setManifestDevDependency } from "../../core/package-json-utils";
import type { PackageManager } from "../../core/package-manager";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";
import { changesetsCliManifest } from "./manifest";

export const changesets = defineToolchain({
  feature: "changesets",
  label: "Changesets",
  hint: "Versioning and changelog workflow",
  package: "@changesets/cli",
  command: "init",
  updatePackageJson({ packageJson }) {
    setManifestDevDependency(packageJson, changesetsCliManifest);
  },
  async afterInstall({ cwd, packageManager }) {
    await runChangesetsInit(cwd, packageManager);
  },
});

function runChangesetsInit(cwd: string, packageManager: PackageManager) {
  const command = resolveCliCommand(changesetsCliManifest, "init", packageManager);
  return runCommand(cwd, command.bin, command.args);
}
