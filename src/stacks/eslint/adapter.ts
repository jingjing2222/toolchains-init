import { addVsCodeExtensionRecommendations, addVsCodeSettings } from "../../core/editor-settings";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

export const eslint = defineToolchain({
  feature: "eslint",
  label: "ESLint",
  catalog: "quality",
  order: 41,
  package: "@eslint/create-config",
  command: "init",
  docs: [
    {
      url: "https://eslint.org/docs/latest/use/getting-started",
      confidence: "high",
      review: {
        reason:
          "Adapter runs the official initializer and assumes ESLint flat config output names.",
        files: ["src/stacks/eslint/adapter.ts", "src/stacks/eslint/init.test.ts"],
        sections: ["Getting Started", "Configuration"],
        mustContain: ["npm init @eslint/config@latest", "eslint.config.js"],
        checks: [
          "Confirm `@eslint/create-config` remains the documented initializer.",
          "Confirm generated config filenames still match adapter target files.",
        ],
      },
    },
  ],
  help: false,
  hint: "Find and fix problems in JavaScript code",
  runner: "dlx",
  subcommand: null,
  async run({ cwd, packageManager }) {
    const { eslintCliManifest } = await import("./manifest");
    const command = resolveCliCommand(eslintCliManifest, "init", packageManager);
    await runCommand(cwd, command.bin, command.args);
  },
  targetFiles() {
    return ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs"];
  },
  async afterWrite({ cwd }) {
    await addVsCodeExtensionRecommendations(cwd, ["dbaeumer.vscode-eslint"]);
    await addVsCodeSettings(cwd, {
      "editor.codeActionsOnSave": {
        "source.fixAll.eslint": "always",
      },
    });
  },
});
