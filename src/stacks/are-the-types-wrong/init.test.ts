import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { areTheTypesWrong, attwCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Are the Types Wrong? adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes the general attw CLI with inherited stdin", async () => {
    expect(areTheTypesWrong.managedCli).toBe(true);
    const command = resolveCliCommand(attwCliManifest, "check", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`@arethetypeswrong/cli@${attwCliManifest.version}`],
    });

    await runExternalToolchains(".", "npm", options(["areTheTypesWrong"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
