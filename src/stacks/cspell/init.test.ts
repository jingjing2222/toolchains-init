import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { cspell, cspellCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("CSpell adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes cspell init with inherited stdin", async () => {
    expect(cspell.managedCli).toBe(true);
    const command = resolveCliCommand(cspellCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`cspell@${cspellCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["cspell"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
