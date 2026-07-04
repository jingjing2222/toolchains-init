import { runCommand } from "../core/run-command";
import type { ToolchainAdapter } from "../core/toolchain-adapter";
import { usesYarnPnp } from "../core/yarn";

export const yarnSdks: ToolchainAdapter = {
  feature: "yarnSdks",
  label: "Yarn SDKs",
  hint: "Generates Yarn PnP editor SDKs for VSCode",
  isAvailable({ cwd, packageManager }) {
    return usesYarnPnp(cwd, packageManager);
  },
  async afterInstall({ cwd }) {
    await runCommand(cwd, "yarn", ["dlx", "@yarnpkg/sdks", "vscode"]);
  },
};
