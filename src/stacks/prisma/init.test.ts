import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { prisma, prismaCliManifest } from "./index";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("Prisma adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("executes prisma init with inherited stdin", async () => {
    expect(prisma.managedCli).toBe(true);
    const command = resolveCliCommand(prismaCliManifest, "init", "npm");
    expect(command).toEqual({
      bin: "npx",
      args: [`prisma@${prismaCliManifest.version}`, "init"],
    });

    await runExternalToolchains(".", "npm", options(["prisma"]));

    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args);
  });
});
