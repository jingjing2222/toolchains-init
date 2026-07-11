import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { areTheTypesWrong, attwCliManifest } from "./index";
import {
  adapterInitTimeout,
  createFreshViteProject,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Are the Types Wrong? adapter init", () => {
  it("limits in-place packing to npm, as required by the upstream CLI", () => {
    expect(areTheTypesWrong.cli?.packageManagers).toEqual(["npm"]);
    expect(attwCliManifest.commands[0]?.packageManagers).toEqual({
      npm: ["npx", "@arethetypeswrong/cli@{version}"],
    });
  });

  it(
    "adds the current-package script in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["areTheTypesWrong"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      expect((await readPackageJson(cwd)).scripts?.attw).toBeUndefined();

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect((await readPackageJson(cwd)).scripts?.attw).toBe(
        `npx @arethetypeswrong/cli@${attwCliManifest.version} --pack .`,
      );

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      const finalPackageJson = await readPackageJson(cwd);
      expect(finalPackageJson.scripts?.attw).toBe(
        `npx @arethetypeswrong/cli@${attwCliManifest.version} --pack .`,
      );
      expect(finalPackageJson.dependencies?.["@arethetypeswrong/cli"]).toBeUndefined();
      expect(finalPackageJson.devDependencies?.["@arethetypeswrong/cli"]).toBeUndefined();
    },
    adapterInitTimeout,
  );
});
