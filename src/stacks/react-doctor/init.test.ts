import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { reactDoctor, reactDoctorCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("React Doctor adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes the bare React Doctor CLI with inherited stdin", async () => {
    expect(reactDoctor.managedCli).toBe(true);
    const command = resolveCliCommand(reactDoctorCliManifest, "check", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`react-doctor@${reactDoctorCliManifest.version}`],
    });

    await runExternalToolchains(".", "npm", options(["reactDoctor"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
