import { describe, expect, it } from "vitest";
import { runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readJson,
  readPackageJson,
} from "../init-test-utils";

describe("ESLint adapter init", () => {
  it(
    "keeps ESLint config with the official initializer and adds editor settings",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["eslint"]);

      await expectFileToExist(cwd, "package.json");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      const settings = await readJson(`${cwd}/.vscode/settings.json`);
      expect(settings["editor.codeActionsOnSave"]).toEqual({
        "source.fixAll.eslint": "always",
      });

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "package.json");
    },
    adapterInitTimeout,
  );
});
