import fs from "node:fs/promises";
import path from "node:path";
import { addVsCodeExtensionRecommendations, addVsCodeSettings } from "../../core/editor-settings";
import { setManifestDevDependency, setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

const prettierVsCodeLanguages = [
  "css",
  "graphql",
  "html",
  "javascript",
  "javascriptreact",
  "json",
  "jsonc",
  "markdown",
  "typescript",
  "typescriptreact",
  "yaml",
];

export const prettier = defineToolchain({
  feature: "prettier",
  label: "Prettier",
  catalog: "quality",
  order: 31,
  package: "prettier",
  command: "check",
  docs: [
    { url: "https://prettier.io/docs/install", confidence: "high" },
    { url: "https://prettier.io/docs/configuration", confidence: "high" },
  ],
  hint: "Opinionated code formatter",
  subcommand: null,
  updatePackageJson({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
    setScript(packageJson, "format", "prettier --write .");
    setScript(packageJson, "format:check", "prettier --check .");
  },
  targetFiles() {
    return [".prettierrc"];
  },
  async afterWrite({ cwd, options }) {
    await writePrettierConfig(cwd);
    await addVsCodeExtensionRecommendations(cwd, ["esbenp.prettier-vscode"]);
    await addVsCodeSettings(
      cwd,
      getPrettierVsCodeSettings(hasCompetingFormatter(options.features)),
    );
  },
  notes({ options }) {
    const notes = [
      "Install the Prettier editor extension: VS Code/Cursor `esbenp.prettier-vscode`.",
    ];
    if (hasCompetingFormatter(options.features)) {
      notes.push(
        "Prettier is selected with Biome or oxfmt, so no default formatter was set for VS Code/Cursor.",
      );
    }
    return notes;
  },
});

async function writePrettierConfig(cwd: string) {
  await fs.writeFile(path.join(cwd, ".prettierrc"), "{}\n");
}

function getPrettierVsCodeSettings(hasCompetingFormatter: boolean) {
  if (hasCompetingFormatter) {
    return {};
  }

  return Object.fromEntries(
    prettierVsCodeLanguages.map((language) => [
      `[${language}]`,
      {
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true,
      },
    ]),
  );
}

function hasCompetingFormatter(features: readonly string[]) {
  return features.includes("biome") || features.includes("oxfmt");
}
