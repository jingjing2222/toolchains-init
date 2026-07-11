import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { secretlint, secretlintCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Secretlint adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes secretlint --init with inherited stdin", async () => {
    expect(secretlint.managedCli).toBe(true);
    const command = resolveCliCommand(secretlintCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`secretlint@${secretlintCliManifest.version}`, "--init"],
    });

    await runExternalToolchains(".", "npm", options(["secretlint"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
