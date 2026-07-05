import { resolveCliCommand } from "../../core/cli-command-manifest";
import type { PackageManager } from "../../core/package-manager";
import { hasPackageDependency } from "../../core/package-json-utils";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

export const storybook = defineToolchain({
  feature: "storybook",
  label: "Storybook",
  catalog: "quality",
  order: 25,
  package: "create-storybook",
  command: "init",
  hint: "Frontend workshop for building UI components and pages in isolation",
  docs: [
    { url: "https://storybook.js.org/docs/get-started/install", confidence: "high" },
    { url: "https://storybook.js.org/docs/api/cli-options", confidence: "high" },
  ],
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  runner: "create",
  subcommand: null,
  isAvailable({ packageJson, packageManager }) {
    if (packageManager === "deno") {
      return false;
    }

    return hasPackageDependency(packageJson, "react") && hasPackageDependency(packageJson, "vite");
  },
  async run({ cwd, packageManager, yes }) {
    const { storybookCliManifest } = await import("./manifest");
    const command = resolveCliCommand(storybookCliManifest, "init", packageManager, {
      builder: "vite",
      disableTelemetry: true,
      loglevel: "warn",
      noAgent: true,
      noDev: true,
      noFeatures: yes,
      packageManager: getStorybookPackageManager(packageManager),
      skipInstall: true,
      type: "react",
      yes,
    });

    await runCommand(cwd, command.bin, command.args);
  },
  targetFiles() {
    return [
      ".storybook/main.ts",
      ".storybook/preview.tsx",
      "src/stories/Button.stories.ts",
      "src/stories/Button.tsx",
      "src/stories/Header.stories.ts",
      "src/stories/Header.tsx",
      "src/stories/Page.stories.ts",
      "src/stories/Page.tsx",
    ];
  },
});

function getStorybookPackageManager(packageManager: PackageManager) {
  return packageManager === "yarn" ? "yarn2" : packageManager;
}
