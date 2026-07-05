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
  docs: [{ url: "https://eslint.org/docs/latest/use/getting-started", confidence: "high" }],
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
