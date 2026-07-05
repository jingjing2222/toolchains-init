import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setManifestDevDependency } from "../../core/package-json-utils";
import type { PackageManager } from "../../core/package-manager";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

export const changesets = defineToolchain({
  feature: "changesets",
  label: "Changesets",
  hint: "Versioning and changelog workflow",
  catalog: "release",
  order: 80,
  package: "@changesets/cli",
  command: "init",
  updatePackageJson({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
  },
  async afterInstall({ cwd, packageManager }) {
    await runChangesetsInit(cwd, packageManager);
  },
});

function runChangesetsInit(cwd: string, packageManager: PackageManager) {
  return import("./manifest").then(({ changesetsCliManifest }) => {
    const command = resolveCliCommand(changesetsCliManifest, "init", packageManager);
    return runCommand(cwd, command.bin, command.args);
  });
}
