import {
  addVsCodeExtensionRecommendations,
  addVsCodeSettings,
  addZedSettings,
} from "../../core/editor-settings";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setManifestDevDependency } from "../../core/package-json-utils";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

const oxfmtVsCodeLanguages = ["javascript", "javascriptreact", "typescript", "typescriptreact"];
const oxfmtZedLanguages = ["JavaScript", "TypeScript", "TSX", "JSON", "JSONC"];

export const oxfmt = defineToolchain({
  feature: "oxfmt",
  label: "oxfmt",
  hint: "Oxc formatter",
  catalog: "quality",
  order: 30,
  package: "oxfmt",
  command: "init",
  docs: [
    {
      url: "https://oxc.rs/docs/guide/usage/formatter",
      confidence: "high",
      review: {
        reason: "Adapter runs `oxfmt --init` and writes editor formatter settings.",
        files: ["src/stacks/oxfmt/adapter.ts", "src/stacks/oxfmt/init.test.ts"],
        sections: ["Oxfmt", "Configuration", "Editor setup"],
        mustContain: ["oxfmt", "formatter", "Editor setup"],
        checks: [
          "Confirm `oxfmt --init` remains the right config initializer.",
          "Confirm `.oxfmtrc.json` remains the right formatter config path.",
          "Confirm editor setup still uses compatible Oxc formatter settings.",
        ],
      },
    },
  ],
  subcommand: null,
  async run({ cwd, packageManager }) {
    const { oxfmtCliManifest } = await import("./manifest");
    const command = resolveCliCommand(oxfmtCliManifest, "init", packageManager, { init: true });
    await runCommand(cwd, command.bin, command.args);
  },
  updatePackageJson({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
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
});

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
