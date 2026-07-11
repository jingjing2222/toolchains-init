import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { shadcn, shadcnCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("shadcn adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes shadcn init with inherited stdin", async () => {
    expect(shadcn.managedCli).toBe(true);
    const command = resolveCliCommand(shadcnCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`shadcn@${shadcnCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["shadcn"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
