import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { yarnSdks, yarnSdksCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Yarn SDKs adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes yarn sdks vscode with inherited stdin", async () => {
    expect(yarnSdks.managedCli).toBe(true);
    const command = resolveCliCommand(yarnSdksCliManifest, "vscode", "yarn");
    expect(command).toEqual({
      bin: "yarn",
      args: ["dlx", `@yarnpkg/sdks@${yarnSdksCliManifest.version}`, "vscode"],
    });

    await runExternalToolchains(".", "yarn", options(["yarnSdks"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
