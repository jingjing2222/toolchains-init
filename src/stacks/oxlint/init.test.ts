import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { oxlint, oxlintCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("oxlint adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes oxlint --init with inherited stdin", async () => {
    expect(oxlint.managedCli).toBe(true);
    const command = resolveCliCommand(oxlintCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`oxlint@${oxlintCliManifest.version}`, "--init"],
    });

    await runExternalToolchains(".", "npm", options(["oxlint"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
