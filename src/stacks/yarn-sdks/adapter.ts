import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runCommand } from "../../core/run-command";
import type { ToolchainAdapter } from "../../core/toolchain-adapter";
import { usesYarnPnp } from "../../core/yarn";
import { yarnSdksCliManifest } from "./manifest";

export const yarnSdks: ToolchainAdapter = {
  feature: "yarnSdks",
  label: "Yarn SDKs",
  hint: "Generates Yarn PnP editor SDKs for VSCode",
  isAvailable({ cwd, packageManager }) {
    return usesYarnPnp(cwd, packageManager);
  },
  async afterInstall({ cwd }) {
    const command = resolveCliCommand(yarnSdksCliManifest, "vscode", "yarn");
    await runCommand(cwd, command.bin, command.args);
  },
};
