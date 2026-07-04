import {
  addVsCodeExtensionRecommendations,
  addVsCodeSettings,
  addZedSettings,
} from "../core/editor-settings";
import fs from "node:fs/promises";
import path from "node:path";
import { setDevDependency } from "../core/package-json-utils";
import type { PackageManager } from "../core/package-manager";
import { runCommand } from "../core/run-command";
import type { ToolchainAdapter } from "../core/toolchain-adapter";
import { usesYarnPnp } from "../core/yarn";

const nodeModulesSchemaPath = "./node_modules/oxlint/configuration_schema.json";

export const oxlint: ToolchainAdapter = {
  feature: "oxlint",
  label: "oxlint",
  hint: "Oxc linter",
  async run({ cwd, packageManager }) {
    await runCommand(cwd, "npx", ["oxlint@latest", "--init"]);
    await normalizeOxlintConfigForPackageManager(cwd, packageManager);
  },
  updatePackageJson({ packageJson }) {
    setDevDependency(packageJson, "oxlint", "^1.72.0");
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
};

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
