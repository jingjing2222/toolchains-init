import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { supabase, supabaseCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Supabase adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes supabase init with inherited stdin", async () => {
    expect(supabase.managedCli).toBe(true);
    const command = resolveCliCommand(supabaseCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`supabase@${supabaseCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["supabase"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
