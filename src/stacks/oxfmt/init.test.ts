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

describe("oxfmt adapter init", () => {
  it(
    "scaffolds formatter config and editor settings in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["oxfmt"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, ".oxfmtrc.json");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      const settings = await readJson(`${cwd}/.vscode/settings.json`);
      expect(settings["oxc.fmt.configPath"]).toBe(".oxfmtrc.json");

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, ".oxfmtrc.json");
    },
    adapterInitTimeout,
  );
});
