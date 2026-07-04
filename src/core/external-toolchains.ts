import { getSelectedToolchains } from "../stacks";
import type { PackageManager } from "./package-manager";
import type { ToolchainOptions } from "./types";

export async function runExternalToolchains(
  cwd: string,
  packageManager: PackageManager,
  options: ToolchainOptions,
  yes: boolean,
) {
  for (const toolchain of getSelectedToolchains(options.features)) {
    await toolchain.run?.({ cwd, packageManager, options, yes });
  }
}

export async function runPostInstallToolchains(
  cwd: string,
  packageManager: PackageManager,
  options: ToolchainOptions,
  yes: boolean,
) {
  for (const toolchain of getSelectedToolchains(options.features)) {
    await toolchain.afterInstall?.({ cwd, packageManager, options, yes });
  }
}
