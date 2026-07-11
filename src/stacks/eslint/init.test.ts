import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains, runPostInstallToolchains } from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import { eslint } from "./adapter";
import { eslintCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readJson,
  readPackageJson,
} from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("ESLint adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("keeps the official initializer interactive and manifest-backed", async () => {
    expect(eslint.nonInteractive).toEqual({
      supported: false,
      reason: "@eslint/create-config still prompts for dependency installation",
    });
    const command = resolveCliCommand(eslintCliManifest, "init", "npm");

    await runExternalToolchains(".", "npm", options(["eslint"]), false);

    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args, {
      stdin: "inherit",
    });
  });

  it(
    "keeps ESLint config with the official initializer and adds editor settings",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options(["eslint"]);

      await expectFileToExist(cwd, "package.json");

      await writeToolchain(cwd, packageJson, toolchainOptions);
      const settings = await readJson(`${cwd}/.vscode/settings.json`);
      expect(settings["editor.codeActionsOnSave"]).toEqual({
        "source.fixAll.eslint": "always",
      });

      await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);
      await expectFileToExist(cwd, "package.json");
    },
    adapterInitTimeout,
  );
});
