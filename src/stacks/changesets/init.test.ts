import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { changesets, changesetsCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Changesets adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes changeset init with inherited stdin", async () => {
    expect(changesets.managedCli).toBe(true);
    const command = resolveCliCommand(changesetsCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`@changesets/cli@${changesetsCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["changesets"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
