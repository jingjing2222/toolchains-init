import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { tanStackRouter, tanStackRouterCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("TanStack Router adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes create --router-only with inherited stdin", async () => {
    expect(tanStackRouter.managedCli).toBe(true);
    const command = resolveCliCommand(tanStackRouterCliManifest, "create-router", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`@tanstack/cli@${tanStackRouterCliManifest.version}`, "create", "--router-only"],
    });

    await runExternalToolchains(".", "npm", options(["router"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
