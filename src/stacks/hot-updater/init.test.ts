import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { hotUpdater, hotUpdaterCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Hot Updater adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes hot-updater init with inherited stdin", async () => {
    expect(hotUpdater.managedCli).toBe(true);
    const command = resolveCliCommand(hotUpdaterCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`hot-updater@${hotUpdaterCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["hotUpdater"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
