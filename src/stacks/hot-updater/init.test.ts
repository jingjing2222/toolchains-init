import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { updatePackageJsonBeforeRun } from "../../core/package-json";
import { getAvailableToolchains } from "..";
import { hotUpdater } from "./adapter";
import { hotUpdaterCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

const execFileAsync = promisify(execFile);
const hotUpdaterE2EProvider = process.env.HOT_UPDATER_E2E_PROVIDER;
const itHotUpdaterE2E = hotUpdaterE2EProvider == null ? it.skip : it;
const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Hot Updater adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("keeps provider setup interactive and the command manifest-backed", async () => {
    expect(hotUpdater.nonInteractive).toEqual({
      supported: false,
      reason: "provider setup requires project-specific interactive choices",
    });
    const command = resolveCliCommand(hotUpdaterCliManifest, "init", "npm");

    await runExternalToolchains(".", "npm", options(["hotUpdater"]), false);

    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args, {
      stdin: "inherit",
    });
    await expect(runExternalToolchains(".", "npm", options(["hotUpdater"]), true)).rejects.toThrow(
      "initializer is interactive",
    );
    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
  });

  it("is only available for React Native projects", async () => {
    const cwd = await createFreshViteProject();
    const packageJson = await readPackageJson(cwd);

    expect(await hotUpdater.isAvailable?.({ cwd, packageJson, packageManager: "npm" })).toBe(false);
  });

  it("inherits package-manager availability from its CLI declaration", async () => {
    const cwd = await createFreshReactNativePackageJson();
    const packageJson = await readPackageJson(cwd);

    const npmFeatures = (
      await getAvailableToolchains({ cwd, packageJson, packageManager: "npm" })
    ).map((toolchain) => toolchain.feature);
    const denoFeatures = (
      await getAvailableToolchains({ cwd, packageJson, packageManager: "deno" })
    ).map((toolchain) => toolchain.feature);

    expect(npmFeatures).toContain("hotUpdater");
    expect(denoFeatures).not.toContain("hotUpdater");
  });

  it("adds the Hot Updater CLI package before running the initializer", async () => {
    const cwd = await createFreshReactNativePackageJson();
    const packageJson = await readPackageJson(cwd);
    const { hotUpdaterCliManifest } = await import("./manifest");

    const beforeRunPackageJson = updatePackageJsonBeforeRun(packageJson, options(["hotUpdater"]));
    expect(beforeRunPackageJson.devDependencies?.["hot-updater"]).toBe(
      hotUpdaterCliManifest.version,
    );
  });

  itHotUpdaterE2E(
    "runs Hot Updater init against the latest React Native app scaffold",
    async () => {
      const workspace = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-hot-updater-e2e-"));
      const appName = "HotUpdaterSmoke";
      const cwd = path.join(workspace, appName);
      const provider = hotUpdaterE2EProvider ?? "supabase";
      try {
        await execFileAsync(
          "npx",
          [
            "--yes",
            "@react-native-community/cli@latest",
            "init",
            appName,
            "--pm",
            "npm",
            "--skip-install",
          ],
          {
            cwd: workspace,
            maxBuffer: 20 * 1024 * 1024,
            timeout: adapterInitTimeout,
          },
        );

        await execFileAsync(
          "npm",
          ["install", `hot-updater@${hotUpdaterCliManifest.version}`, "--save-dev"],
          {
            cwd,
            maxBuffer: 20 * 1024 * 1024,
            timeout: adapterInitTimeout,
          },
        );
        await execFileAsync(
          "npx",
          ["hot-updater", "init", "--build", "bare", "--provider", provider],
          {
            cwd,
            maxBuffer: 20 * 1024 * 1024,
            timeout: adapterInitTimeout,
          },
        );

        await expectFileToExist(cwd, "hot-updater.config.ts");
        await expectFileToExist(cwd, ".env.hotupdater");
      } finally {
        await rm(workspace, { force: true, recursive: true });
      }
    },
    adapterInitTimeout * 3,
  );
});

async function createFreshReactNativePackageJson() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-hot-updater-"));
  await writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify(
      {
        name: "hot-updater-smoke",
        version: "0.0.0",
        private: true,
        dependencies: {
          react: "19.2.3",
          "react-native": "0.86.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  return cwd;
}
