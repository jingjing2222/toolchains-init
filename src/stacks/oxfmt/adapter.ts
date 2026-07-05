import {
  addVsCodeExtensionRecommendations,
  addVsCodeSettings,
  addZedSettings,
} from "../../core/editor-settings";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setDevDependency } from "../../core/package-json-utils";
import { runCommand } from "../../core/run-command";
import type { ToolchainAdapter } from "../../core/toolchain-adapter";
import { oxfmtCliManifest } from "./manifest";

const oxfmtVsCodeLanguages = ["javascript", "javascriptreact", "typescript", "typescriptreact"];
const oxfmtZedLanguages = ["JavaScript", "TypeScript", "TSX", "JSON", "JSONC"];

export const oxfmt: ToolchainAdapter = {
  feature: "oxfmt",
  label: "oxfmt",
  hint: "Oxc formatter",
  async run({ cwd, packageManager }) {
    const command = resolveCliCommand(oxfmtCliManifest, "init", packageManager, { init: true });
    await runCommand(cwd, command.bin, command.args);
  },
  updatePackageJson({ packageJson }) {
    setDevDependency(packageJson, "oxfmt", "^0.57.0");
  },
  async afterWrite({ cwd, options }) {
    await addVsCodeExtensionRecommendations(cwd, ["oxc.oxc-vscode"]);
    await addVsCodeSettings(cwd, getOxfmtVsCodeSettings(options.features.includes("biome")));
    await addZedSettings(cwd, getOxfmtZedSettings(options.features.includes("biome")));
  },
  notes({ options }) {
    const notes = [
      "Install the Oxc editor extension: VS Code/Cursor `oxc.oxc-vscode`; Zed: search `Oxc`.",
    ];
    if (options.features.includes("biome")) {
      notes.push(
        "Biome and oxfmt are both selected, so no default formatter was set for VS Code/Cursor/Zed.",
      );
    }
    return notes;
  },
};

function getOxfmtVsCodeSettings(hasBiome: boolean) {
  const settings: Record<string, unknown> = {
    "oxc.fmt.configPath": ".oxfmtrc.json",
  };

  if (!hasBiome) {
    for (const language of oxfmtVsCodeLanguages) {
      settings[`[${language}]`] = {
        "editor.defaultFormatter": "oxc.oxc-vscode",
        "editor.formatOnSave": true,
      };
    }
  }

  return settings;
}

function getOxfmtZedSettings(hasBiome: boolean) {
  const settings: Record<string, unknown> = {
    lsp: {
      oxfmt: {
        initialization_options: {
          settings: {
            "fmt.configPath": ".oxfmtrc.json",
            run: "onSave",
          },
        },
      },
    },
  };

  if (!hasBiome) {
    settings.languages = Object.fromEntries(
      oxfmtZedLanguages.map((language) => [
        language,
        {
          format_on_save: "on",
          formatter: [{ language_server: { name: "oxfmt" } }],
        },
      ]),
    );
  }

  return settings;
}
