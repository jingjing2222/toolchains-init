import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { oxfmt, oxfmtCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("oxfmt adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes oxfmt --init with inherited stdin", async () => {
    expect(oxfmt.managedCli).toBe(true);
    const command = resolveCliCommand(oxfmtCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`oxfmt@${oxfmtCliManifest.version}`, "--init"],
    });

    await runExternalToolchains(".", "npm", options(["oxfmt"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
