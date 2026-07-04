import {
  addVsCodeExtensionRecommendations,
  addVsCodeSettings,
  addZedSettings,
} from "../core/editor-settings";
import { setDevDependency } from "../core/package-json-utils";
import type { PackageManager } from "../core/package-manager";
import { runCommand } from "../core/run-command";
import type { ToolchainAdapter } from "../core/toolchain-adapter";

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
  if (packageManager === "npm") {
    return runCommand(cwd, "npx", ["@biomejs/biome", "init"]);
  }

  if (packageManager === "pnpm") {
    return runCommand(cwd, "pnpm", ["exec", "biome", "init"]);
  }

  return runCommand(cwd, "yarn", ["exec", "biome", "--", "init"]);
}
