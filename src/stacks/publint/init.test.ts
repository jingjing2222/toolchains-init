import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { publint, publintCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("publint adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes the bare publint CLI with inherited stdin", async () => {
    expect(publint.managedCli).toBe(true);
    const command = resolveCliCommand(publintCliManifest, "check", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`publint@${publintCliManifest.version}`],
    });

    await runExternalToolchains(".", "npm", options(["publint"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
