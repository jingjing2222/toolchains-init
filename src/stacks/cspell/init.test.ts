import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { resolveManagedCliPlans } from "../../core/managed-cli";
import { cspell } from "./adapter";
import { cspellCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("CSpell adapter init", () => {
  it("declares a fully unattended initializer", () => {
    expect(cspell.managedCli).toEqual({
      phase: "run",
      blocked: {
        stdout: "Standard-output mode does not initialize a CSpell config file.",
      },
    });
    expect(cspell.nonInteractive).toBeUndefined();
  });

  it("resolves the bare official init command and generated target", () => {
    expect(resolveCliCommand(cspellCliManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`cspell@${cspellCliManifest.version}`, "init"],
    });
    expect(cspell.targetFiles?.(options(["cspell"]))).toEqual([
      "cspell.config.yaml",
      "cspell.config.yml",
      "cspell.json",
      "cspell.jsonc",
    ]);
  });

  it("blocks stdout-only output from bypassing config initialization", () => {
    expect(() =>
      resolveManagedCliPlans({
        manifests: [cspellCliManifest],
        options: options(["cspell"]),
        packageManager: "npm",
        selectedToolchains: [cspell],
        userFlags: { cspell: { stdout: true } },
        yes: true,
      }),
    ).toThrow("--cspell.stdout is blocked");
  });

  it(
    "creates the default config without mutating package dependencies",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["cspell"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "cspell.config.yaml");
      expect(await readPackageJson(cwd)).toEqual(packageJson);

      await writeToolchain(cwd, packageJson, toolchainOptions);
      expect(await readPackageJson(cwd)).toEqual(packageJson);

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "cspell.config.yaml");
      expect(await readPackageJson(cwd)).toEqual(packageJson);
    },
    adapterInitTimeout,
  );
});
