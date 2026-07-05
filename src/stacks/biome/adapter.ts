import {
  addVsCodeExtensionRecommendations,
  addVsCodeSettings,
  addZedSettings,
} from "../../core/editor-settings";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setDevDependency } from "../../core/package-json-utils";
import type { PackageManager } from "../../core/package-manager";
import { runCommand } from "../../core/run-command";
import type { ToolchainAdapter } from "../../core/toolchain-adapter";
import { biomeCliManifest } from "./manifest";

const biomeVsCodeLanguages = ["javascript", "javascriptreact", "typescript", "typescriptreact"];

export const biome: ToolchainAdapter = {
  feature: "biome",
  label: "Biome",
  hint: "Formatter and linter setup through Biome CLI",
  updatePackageJson({ packageJson }) {
    setDevDependency(packageJson, "@biomejs/biome", "2.5.2");
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
};

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
  const command = resolveCliCommand(biomeCliManifest, "init", packageManager);
  return runCommand(cwd, command.bin, command.args);
}
