import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { prettierCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readJson,
  readPackageJson,
} from "../init-test-utils";

describe("Prettier adapter init", () => {
  it(
    "scaffolds Prettier config and editor settings in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["prettier"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "package.json");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      const updatedPackageJson = await readPackageJson(cwd);
      expect(updatedPackageJson.devDependencies?.prettier).toBe(prettierCliManifest.version);
      expect(updatedPackageJson.scripts?.format).toBe("prettier --write .");
      expect(updatedPackageJson.scripts?.["format:check"]).toBe("prettier --check .");
      await expectFileToExist(cwd, ".prettierrc");
      const settings = await readJson(`${cwd}/.vscode/settings.json`);
      expect(settings["[typescript]"]).toEqual({
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "editor.formatOnSave": true,
      });

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, ".prettierrc");
    },
    adapterInitTimeout,
  );
});
