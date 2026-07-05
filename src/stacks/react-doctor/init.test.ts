import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { reactDoctorCliManifest } from "./index";
import {
  adapterInitTimeout,
  createFreshViteProject,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("React Doctor adapter init", () => {
  it(
    "adds the package script in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["reactDoctor"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      expect((await readPackageJson(cwd)).scripts?.["react-doctor"]).toBeUndefined();

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect((await readPackageJson(cwd)).scripts?.["react-doctor"]).toBe(
        `npx react-doctor@${reactDoctorCliManifest.version}`,
      );

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      expect((await readPackageJson(cwd)).scripts?.["react-doctor"]).toBe(
        `npx react-doctor@${reactDoctorCliManifest.version}`,
      );
    },
    adapterInitTimeout,
  );
});
