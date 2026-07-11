import { getSelectedToolchains } from "../stacks/index";
import { resolveManagedCliPlans, type ManagedCliPlans } from "./managed-cli";
import type { PackageManager } from "./package-manager";
import { runCommand } from "./run-command";
import type { ToolchainOptions } from "./types";

export async function runExternalToolchains(
  cwd: string,
  packageManager: PackageManager,
  options: ToolchainOptions,
  plans?: ManagedCliPlans,
) {
  const selectedToolchains = getSelectedToolchains(options.features);
  const resolvedPlans =
    plans ??
    resolveManagedCliPlans({
      packageManager,
      selectedToolchains,
    });

  for (const toolchain of selectedToolchains) {
    const plan = resolvedPlans.get(toolchain.feature);
    if (plan != null) {
      await runCommand(cwd, plan.command.bin, plan.command.args);
    }
  }
}
