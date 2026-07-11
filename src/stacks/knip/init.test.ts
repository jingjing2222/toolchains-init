import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { knip, knipCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Knip adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes the bare Knip CLI with inherited stdin", async () => {
    expect(knip.managedCli).toBe(true);
    const command = resolveCliCommand(knipCliManifest, "check", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`knip@${knipCliManifest.version}`],
    });

    await runExternalToolchains(".", "npm", options(["knip"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
