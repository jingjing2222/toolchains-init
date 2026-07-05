import {
  addVsCodeExtensionRecommendations,
  addVsCodeSettings,
  addZedSettings,
} from "../../core/editor-settings";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setManifestDevDependency } from "../../core/package-json-utils";
import type { PackageManager } from "../../core/package-manager";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

const biomeVsCodeLanguages = ["javascript", "javascriptreact", "typescript", "typescriptreact"];

export const biome = defineToolchain({
  feature: "biome",
  label: "Biome",
  hint: "Formatter and linter setup through Biome CLI",
  catalog: "quality",
  order: 50,
  package: "@biomejs/biome",
  command: "init",
  docs: [
    {
      url: "https://biomejs.dev/reference/configuration/",
      confidence: "high",
      review: {
        reason:
          "Adapter installs Biome and writes editor settings that assume Biome config-file behavior.",
        files: ["src/stacks/biome/adapter.ts", "src/stacks/biome/init.test.ts"],
        sections: ["Configuration"],
        mustContain: ["biome.json", "configuration file"],
        checks: [
          "Confirm `biome init` still creates a config file for project-local setup.",
          "Confirm `biome.requireConfiguration` and Zed `require_config_file` remain valid editor settings.",
        ],
      },
    },
  ],
  updatePackageJson({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
  },
  async afterWrite({ cwd, options }) {
    await addVsCodeExtensionRecommendations(cwd, ["biomejs.biome"]);
    await addVsCodeSettings(cwd, getBiomeVsCodeSettings(options.features.includes("oxfmt")));
    await addZedSettings(cwd, {
      lsp: {
        biome: {
          settings: {
            require_config_file: true,
          },
        },
      },
    });
  },
  async afterInstall({ cwd, packageManager }) {
    await runBiomeInit(cwd, packageManager);
  },
  notes({ options }) {
    const notes = [
      "Install the Biome editor extension: VS Code/Cursor `biomejs.biome`; Zed: search `Biome`.",
    ];
    if (options.features.includes("oxfmt")) {
      notes.push(
        "Biome and oxfmt are both selected, so no default formatter was set for VS Code/Cursor/Zed.",
      );
    }
    return notes;
  },
});

function getBiomeVsCodeSettings(hasOxfmt: boolean) {
  if (hasOxfmt) {
    return {
      "biome.enabled": true,
      "biome.requireConfiguration": true,
    };
  }

  return Object.fromEntries(
    biomeVsCodeLanguages.map((language) => [
      `[${language}]`,
      {
        "editor.defaultFormatter": "biomejs.biome",
        "editor.formatOnSave": true,
      },
    ]),
  );
}

function runBiomeInit(cwd: string, packageManager: PackageManager) {
  return import("./manifest").then(({ biomeCliManifest }) => {
    const command = resolveCliCommand(biomeCliManifest, "init", packageManager);
    return runCommand(cwd, command.bin, command.args);
  });
}
