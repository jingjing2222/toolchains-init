import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { eslint, eslintCliManifest } from "./index";
import { options } from "../init-test-utils";

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

  it("executes the official ESLint configuration CLI with inherited stdin", async () => {
    expect(eslint.managedCli).toBe(true);
    const command = resolveCliCommand(eslintCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`@eslint/create-config@${eslintCliManifest.version}`],
    });

    await runExternalToolchains(".", "npm", options(["eslint"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
