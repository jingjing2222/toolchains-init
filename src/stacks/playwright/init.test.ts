import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Playwright adapter init", () => {
  it(
    "scaffolds Playwright config and package entries in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["playwright"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "playwright.config.ts");
      await expectFileToExist(cwd, "tests/example.spec.ts");
      expect((await readPackageJson(cwd)).devDependencies?.["@playwright/test"]).toBeDefined();

      await writeToolchain(cwd, packageJson, toolchainOptions);
      await expectFileToExist(cwd, "package.json");

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "playwright.config.ts");
    },
    adapterInitTimeout,
  );
});
