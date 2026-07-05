import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { biomeCliManifest } from "./index";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  expectFileNotToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Biome adapter init", () => {
  it(
    "pins the package and scaffolds Biome config in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["biome"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileNotToExist(cwd, "biome.json");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect((await readPackageJson(cwd)).devDependencies?.["@biomejs/biome"]).toBe(
        biomeCliManifest.version,
      );

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "biome.json");
    },
    adapterInitTimeout,
  );
});
