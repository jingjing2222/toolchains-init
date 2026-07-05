import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { changesetsCliManifest } from "./index";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  expectFileNotToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Changesets adapter init", () => {
  it(
    "pins the package and scaffolds Changesets config in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["changesets"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileNotToExist(cwd, ".changeset/config.json");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect((await readPackageJson(cwd)).devDependencies?.["@changesets/cli"]).toBe(
        changesetsCliManifest.version,
      );

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, ".changeset/config.json");
    },
    adapterInitTimeout,
  );
});
