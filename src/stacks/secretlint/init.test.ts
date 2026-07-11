import { describe, expect, it } from "vitest";
import { resolveManagedCliPlans } from "../../core/managed-cli";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { secretlint } from "./adapter";
import { secretlintCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readJson,
  readPackageJson,
} from "../init-test-utils";

describe("Secretlint adapter init", () => {
  it("declares a fully unattended initializer", () => {
    expect(secretlint.managedCli).toEqual({
      phase: "run",
      locked: { init: true },
    });
    expect(secretlint.nonInteractive).toBeUndefined();
  });

  it("resolves the exact flag-based init command and generated target", () => {
    const toolchainOptions = options(["secretlint"]);
    const plan = resolveManagedCliPlans({
      manifests: [secretlintCliManifest],
      options: toolchainOptions,
      packageManager: "npm",
      selectedToolchains: [secretlint],
      yes: true,
    }).get("secretlint");

    expect(plan?.command).toEqual({
      bin: "npx",
      args: [`secretlint@${secretlintCliManifest.version}`, "--init"],
    });
    expect(secretlint.targetFiles?.(toolchainOptions)).toEqual([".secretlintrc.json"]);
  });

  it(
    "creates an empty-rules config without mutating package dependencies",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["secretlint"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, ".secretlintrc.json");
      expect(await readJson(`${cwd}/.secretlintrc.json`)).toEqual({ rules: [] });
      expect(await readPackageJson(cwd)).toEqual(packageJson);

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect(await readPackageJson(cwd)).toEqual(packageJson);

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, ".secretlintrc.json");
      expect(await readPackageJson(cwd)).toEqual(packageJson);
    },
    adapterInitTimeout,
  );
});
