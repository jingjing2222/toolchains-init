import { resolveCliCommand } from "../../core/cli-command-manifest";
import { hasPackageDependency, setManifestDevDependency } from "../../core/package-json-utils";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

export const hotUpdater = defineToolchain({
  feature: "hotUpdater",
  label: "Hot Updater",
  catalog: "app",
  order: 15,
  package: "hot-updater",
  command: "init",
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  hint: "Self-hostable OTA update solution for React Native",
  docs: [{ url: "https://hot-updater.dev/docs/get-started/basic-usage", confidence: "high" }],
  isAvailable({ packageJson, packageManager }) {
    if (packageManager === "deno") {
      return false;
    }

    return hasPackageDependency(packageJson, "react-native");
  },
  async run({ cwd, packageManager, yes }) {
    if (yes) {
      throw new Error("Hot Updater init requires interactive provider setup. Run without --yes.");
    }

    const { hotUpdaterCliManifest } = await import("./manifest");
    const command = resolveCliCommand(hotUpdaterCliManifest, "init", packageManager);
    await runCommand(cwd, command.bin, command.args);
  },
  beforeRun({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
  },
  notes() {
    return [
      "Hot Updater init is interactive and requires a project-specific provider choice.",
      "For custom self-hosting, configure hot-updater.config.ts manually after init dependencies are installed.",
    ];
  },
});
