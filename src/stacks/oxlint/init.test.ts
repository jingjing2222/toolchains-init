import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readJson,
  readPackageJson,
} from "../init-test-utils";

describe("oxlint adapter init", () => {
  it(
    "scaffolds linter config and editor settings in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["oxlint"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      const config = await readJson(`${cwd}/.oxlintrc.json`);
      expect(config.plugins).toContain("typescript");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      const settings = await readJson(`${cwd}/.vscode/settings.json`);
      expect(settings["editor.codeActionsOnSave"]).toEqual({
        "source.fixAll.oxc": "always",
      });

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, ".oxlintrc.json");
    },
    adapterInitTimeout,
  );
});
