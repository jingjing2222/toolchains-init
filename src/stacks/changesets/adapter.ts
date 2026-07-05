import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setDevDependency } from "../../core/package-json-utils";
import type { PackageManager } from "../../core/package-manager";
import { runCommand } from "../../core/run-command";
import type { ToolchainAdapter } from "../../core/toolchain-adapter";
import { changesetsCliManifest } from "./manifest";

export const changesets: ToolchainAdapter = {
  feature: "changesets",
  label: "Changesets",
  hint: "Versioning and changelog workflow",
  updatePackageJson({ packageJson }) {
    setDevDependency(packageJson, "@changesets/cli", "^2.31.0");
  },
  async afterInstall({ cwd, packageManager }) {
    await runChangesetsInit(cwd, packageManager);
  },
};

function runChangesetsInit(cwd: string, packageManager: PackageManager) {
  const command = resolveCliCommand(changesetsCliManifest, "init", packageManager);
  return runCommand(cwd, command.bin, command.args);
}
