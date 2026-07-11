import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { prettier, prettierCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Prettier adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes prettier --check . with inherited stdin", async () => {
    expect(prettier.managedCli).toBe(true);
    const command = resolveCliCommand(prettierCliManifest, "check", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`prettier@${prettierCliManifest.version}`, "--check", "."],
    });

    await runExternalToolchains(".", "npm", options(["prettier"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
