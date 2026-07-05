import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { updatePackageJsonBeforeRun } from "../../core/package-json";
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

describe("Hot Updater adapter init", () => {
  it("is only available for React Native projects", async () => {
    const cwd = await createFreshViteProject();
    const { hotUpdater } = await import("./adapter");

    const packageJson = await readPackageJson(cwd);

    expect(await hotUpdater.isAvailable?.({ cwd, packageJson, packageManager: "npm" })).toBe(false);
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
      const { hotUpdaterCliManifest } = await import("./manifest");

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
