import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { storybook, storybookCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Storybook adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes the official Storybook initializer with inherited stdin", async () => {
    expect(storybook.managedCli).toBe(true);
    const command = resolveCliCommand(storybookCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npm",
      args: ["init", `storybook@${storybookCliManifest.version}`, "--"],
    });

    await runExternalToolchains(".", "npm", options(["storybook"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
