import { getSelectedToolchains } from "../stacks/index";
import { resolveManagedCliPlans, type ManagedCliPlan, type ManagedCliPlans } from "./managed-cli";
import type { PackageManager } from "./package-manager";
import { runCommand } from "./run-command";
import type { ToolchainAdapter } from "./toolchain-adapter";
import type { ToolchainOptions } from "./types";

export async function runExternalToolchains(
  cwd: string,
  packageManager: PackageManager,
  options: ToolchainOptions,
  yes: boolean,
  plans?: ManagedCliPlans,
) {
  const selectedToolchains = getSelectedToolchains(options.features);
  const resolvedPlans =
    plans ??
    resolveManagedCliPlans({
      options,
      packageManager,
      selectedToolchains,
      yes,
    });

  for (const toolchain of selectedToolchains) {
    const plan = resolvedPlans.get(toolchain.feature);
    if (plan?.phase === "run") {
      if (yes && toolchain.nonInteractive?.supported === false) {
        throw new Error(
          `${toolchain.label} initializer is interactive: ${toolchain.nonInteractive.reason}`,
        );
      }
      await executeManagedCli(toolchain, plan, cwd, packageManager, options, yes);
    } else {
      await toolchain.run?.({ cwd, packageManager, options, yes });
    }
  }
}

export async function runPostInstallToolchains(
  cwd: string,
  packageManager: PackageManager,
  options: ToolchainOptions,
  yes: boolean,
  plans?: ManagedCliPlans,
) {
  const selectedToolchains = getSelectedToolchains(options.features);
  const resolvedPlans =
    plans ??
    resolveManagedCliPlans({
      options,
      packageManager,
      selectedToolchains,
      yes,
    });

  for (const toolchain of selectedToolchains) {
    const plan = resolvedPlans.get(toolchain.feature);
    if (plan?.phase === "afterInstall") {
      await executeManagedCli(toolchain, plan, cwd, packageManager, options, yes);
    }
    await toolchain.afterInstall?.({ cwd, packageManager, options, yes });
  }
}

async function executeManagedCli(
  toolchain: ToolchainAdapter,
  plan: ManagedCliPlan,
  cwd: string,
  packageManager: PackageManager,
  options: ToolchainOptions,
  yes: boolean,
) {
  if (toolchain.managedCli?.execute != null) {
    await toolchain.managedCli.execute({
      command: plan.command,
      cwd,
      options,
      packageManager,
      yes,
    });
    return;
  }

  await runCommand(cwd, plan.command.bin, plan.command.args, {
    stdin: yes ? "ignore" : "inherit",
  });
}
