import { describe, expect, it } from "vitest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { resolveManagedCliPlans } from "../../core/managed-cli";
import { tanStackRouter } from "./adapter";
import { tanStackRouterCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("TanStack Router adapter init", () => {
  it.each(["starter", "templateId", "template", "deployment", "addOns", "addOnConfig"])(
    "blocks %s because router-only mode cannot consume it",
    (flag) => {
      const toolchainOptions = options(["router"]);

      expect(() =>
        resolveManagedCliPlans({
          manifests: [tanStackRouterCliManifest],
          options: toolchainOptions,
          packageManager: "npm",
          selectedToolchains: [tanStackRouter],
          userFlags: { router: { [flag]: "example" } },
          yes: true,
        }),
      ).toThrow("is blocked");
    },
  );

  it(
    "scaffolds router files in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["router"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "src/router.tsx");
      await expectFileToExist(cwd, "src/routes/__root.tsx");
      await expectFileToExist(cwd, "src/routes/index.tsx");
      await expectFileToExist(cwd, "tsr.config.json");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      await expectFileToExist(cwd, "package.json");

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "src/router.tsx");
    },
    adapterInitTimeout,
  );
});
