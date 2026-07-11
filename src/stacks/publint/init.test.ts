import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { publintCliManifest } from "./index";
import {
  adapterInitTimeout,
  createFreshViteProject,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("publint adapter init", () => {
  it(
    "adds the package script in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["publint"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      expect((await readPackageJson(cwd)).scripts?.["lint:package"]).toBeUndefined();

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect((await readPackageJson(cwd)).scripts?.["lint:package"]).toBe(
        `npx publint@${publintCliManifest.version}`,
      );

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      const finalPackageJson = await readPackageJson(cwd);
      expect(finalPackageJson.scripts?.["lint:package"]).toBe(
        `npx publint@${publintCliManifest.version}`,
      );
      expect(finalPackageJson.dependencies?.publint).toBeUndefined();
      expect(finalPackageJson.devDependencies?.publint).toBeUndefined();
    },
    adapterInitTimeout,
  );
});
