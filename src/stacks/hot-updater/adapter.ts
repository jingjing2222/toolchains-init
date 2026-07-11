import { hasPackageDependency, setManifestDevDependency } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

export const hotUpdater = defineToolchain({
  feature: "hotUpdater",
  label: "Hot Updater",
  catalog: "app",
  order: 15,
  package: "hot-updater",
  command: "init",
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  nonInteractive: {
    supported: false,
    reason: "provider setup requires project-specific interactive choices",
  },
  hint: "Self-hostable OTA update solution for React Native",
  docs: [
    {
      url: "https://hot-updater.dev/docs/get-started/basic-usage",
      confidence: "high",
      review: {
        reason:
          "Adapter blocks `--yes` because Hot Updater init requires interactive provider setup.",
        files: ["src/stacks/hot-updater/adapter.ts", "src/stacks/hot-updater/init.test.ts"],
        sections: ["Basic Usage", "Initialize Hot Updater"],
        mustContain: ["npx hot-updater init", "Provider Selection"],
        checks: [
          "Confirm `hot-updater init` still requires interactive provider configuration.",
          "Confirm React Native availability remains the right gating condition.",
        ],
      },
    },
  ],
  isAvailable({ packageJson }) {
    return hasPackageDependency(packageJson, "react-native");
  },
  managedCli: {
    phase: "run",
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
