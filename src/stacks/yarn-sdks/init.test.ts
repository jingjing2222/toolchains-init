import { describe, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import {
  adapterInitTimeout,
  createFreshYarnPnpProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Yarn SDKs adapter init", () => {
  it(
    "generates Yarn SDK files in lifecycle order",
    async () => {
      const cwd = await createFreshYarnPnpProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["yarnSdks"]);

      await runExternalToolchains(cwd, "yarn", toolchainOptions, true);
      await expectFileToExist(cwd, ".pnp.cjs");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      await expectFileToExist(cwd, "package.json");

      await runPostInstallToolchains(cwd, "yarn", toolchainOptions, true);
      await expectFileToExist(cwd, ".yarn/sdks/integrations.yml");
      await expectFileToExist(cwd, ".vscode/settings.json");
    },
    adapterInitTimeout,
  );
});
