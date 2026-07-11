import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { msw, mswCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("MSW adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes bare msw init with inherited stdin", async () => {
    expect(msw.managedCli).toBe(true);
    const command = resolveCliCommand(mswCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`msw@${mswCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["msw"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
