import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("MSW adapter init", () => {
  it("is only available for Vite projects with supported package managers", async () => {
    const cwd = await createFreshViteProject();
    const packageJson = await readPackageJson(cwd);
    const { msw } = await import("./adapter");

    expect(await msw.isAvailable?.({ cwd, packageJson, packageManager: "npm" })).toBe(true);
    expect(await msw.isAvailable?.({ cwd, packageJson, packageManager: "deno" })).toBe(false);
    expect(
      await msw.isAvailable?.({
        cwd,
        packageJson: { ...packageJson, dependencies: { react: "^18.3.1" } },
        packageManager: "npm",
      }),
    ).toBe(false);
  });

  it("declares the generated service worker as an overwrite target", async () => {
    const { msw } = await import("./adapter");

    expect(msw.targetFiles?.(options(["msw"]))).toEqual(["public/mockServiceWorker.js"]);
  });

  it("resolves the MSW init command", async () => {
    const { mswCliManifest } = await import("./manifest");

    expect(resolveCliCommand(mswCliManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`msw@${mswCliManifest.version}`, "init"],
    });
  });

  it(
    "scaffolds MSW worker and package entries in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["msw"]);

      await runExternalToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "public/mockServiceWorker.js");
      expect((await readPackageJson(cwd)).msw?.workerDirectory).toEqual(["public"]);

      await writeToolchain(cwd, packageJson, toolchainOptions);
      const nextPackageJson = await readPackageJson(cwd);
      const { mswCliManifest } = await import("./manifest");
      expect(nextPackageJson.devDependencies?.msw).toBe(mswCliManifest.version);
      expect(nextPackageJson.msw?.workerDirectory).toEqual(["public"]);

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "public/mockServiceWorker.js");
    },
    adapterInitTimeout,
  );
});
