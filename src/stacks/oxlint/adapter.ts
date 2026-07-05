import {
  addVsCodeExtensionRecommendations,
  addVsCodeSettings,
  addZedSettings,
} from "../../core/editor-settings";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { setManifestDevDependency } from "../../core/package-json-utils";
import type { PackageManager } from "../../core/package-manager";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";
import { usesYarnPnp } from "../../core/yarn";

const nodeModulesSchemaPath = "./node_modules/oxlint/configuration_schema.json";

export const oxlint = defineToolchain({
  feature: "oxlint",
  label: "oxlint",
  hint: "Oxc linter",
  order: 40,
  package: "oxlint",
  command: "init",
  subcommand: null,
  async run({ cwd, packageManager }) {
    const { oxlintCliManifest } = await import("./manifest");
    const command = resolveCliCommand(oxlintCliManifest, "init", packageManager, { init: true });
    await runCommand(cwd, command.bin, command.args);
    await normalizeOxlintConfigForPackageManager(cwd, packageManager);
  },
  updatePackageJson({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
  },
  async afterWrite({ cwd }) {
    await addVsCodeExtensionRecommendations(cwd, ["oxc.oxc-vscode"]);
    await addVsCodeSettings(cwd, {
      "editor.codeActionsOnSave": {
        "source.fixAll.oxc": "always",
      },
    });
    await addZedSettings(cwd, {
      lsp: {
        oxlint: {
          initialization_options: {
            settings: {
              configPath: null,
              disableNestedConfig: false,
              fixKind: "safe_fix",
              run: "onType",
              unusedDisableDirectives: "deny",
            },
          },
        },
      },
    });
  },
  notes() {
    return [
      "Install the Oxc editor extension: VS Code/Cursor `oxc.oxc-vscode`; Zed: search `Oxc`.",
    ];
  },
});

export async function normalizeOxlintConfigForPackageManager(
  cwd: string,
  packageManager: PackageManager,
) {
  await normalizeOxlintConfig(cwd, usesYarnPnp(cwd, packageManager));
}

export async function normalizeOxlintConfig(cwd: string, shouldRemoveNodeModulesSchema: boolean) {
  if (!shouldRemoveNodeModulesSchema) {
    return;
  }

  const configPath = path.join(cwd, ".oxlintrc.json");
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch {
    return;
  }

  if (config.$schema !== nodeModulesSchemaPath) {
    return;
  }

  delete config.$schema;
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
