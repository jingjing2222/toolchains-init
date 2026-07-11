import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { biome, biomeCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Biome adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes biome init with inherited stdin", async () => {
    expect(biome.managedCli).toBe(true);
    const command = resolveCliCommand(biomeCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`@biomejs/biome@${biomeCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["biome"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
