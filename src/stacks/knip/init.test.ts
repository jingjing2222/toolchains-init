import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { knipCliManifest } from "./index";
import {
  adapterInitTimeout,
  createFreshViteProject,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Knip adapter init", () => {
  it(
    "adds the package script in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["knip"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      expect((await readPackageJson(cwd)).scripts?.knip).toBeUndefined();

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect((await readPackageJson(cwd)).scripts?.knip).toBe(
        `npx knip@${knipCliManifest.version}`,
      );

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      expect((await readPackageJson(cwd)).scripts?.knip).toBe(
        `npx knip@${knipCliManifest.version}`,
      );
    },
    adapterInitTimeout,
  );
});
