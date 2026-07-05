import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";
import { usesYarnPnp } from "../../core/yarn";

export const yarnSdks = defineToolchain({
  feature: "yarnSdks",
  label: "Yarn SDKs",
  hint: "Generates Yarn PnP editor SDKs for VSCode",
  order: 90,
  package: "@yarnpkg/sdks",
  command: "vscode",
  help: false,
  packageManagers: ["yarn"],
  isAvailable({ cwd, packageManager }) {
    return usesYarnPnp(cwd, packageManager);
  },
  async afterInstall({ cwd }) {
    const { yarnSdksCliManifest } = await import("./manifest");
    const command = resolveCliCommand(yarnSdksCliManifest, "vscode", "yarn");
    await runCommand(cwd, command.bin, command.args);
  },
});
