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
    {
      url: "https://storybook.js.org/docs/get-started/install",
      confidence: "high",
      review: {
        reason: "Adapter runs the Storybook initializer only for React + Vite projects.",
        files: ["src/stacks/storybook/adapter.ts", "src/stacks/storybook/init.test.ts"],
        sections: ["Install Storybook"],
        mustContain: ["storybook@latest init", "React"],
        checks: [
          "Confirm `create-storybook init` remains the recommended initializer.",
          "Confirm React + Vite availability remains the intended project scope.",
        ],
      },
    },
    {
      url: "https://storybook.js.org/docs/api/cli-options",
      confidence: "high",
      review: {
        reason: "Adapter pins several non-interactive Storybook CLI options.",
        files: ["src/stacks/storybook/adapter.ts", "src/stacks/storybook/init.test.ts"],
        sections: ["CLI options"],
        mustContain: ["--builder", "--skip-install", "--package-manager"],
        checks: [
          "Confirm `--builder vite`, `--skip-install`, `--no-dev`, and package-manager options still exist.",
          "Confirm `yarn` still needs the `yarn2` package-manager value.",
        ],
      },
    },
  ],
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  runner: "create",
  subcommand: null,
  isAvailable({ packageJson }) {
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
