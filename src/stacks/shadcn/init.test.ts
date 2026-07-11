import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { resolveManagedCliPlans } from "../../core/managed-cli";
import { runExternalToolchains } from "../../core/external-toolchains";
import { shadcn } from "./adapter";
import { shadcnCliManifest } from "./manifest";
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

  it("declares the project-specific initializer as interactive-only", () => {
    expect(shadcn.managedCli).toEqual({
      phase: "run",
      blocked: {
        cwd: "The initializer always runs in the selected target directory.",
      },
    });
    expect(shadcn.nonInteractive).toEqual({
      supported: false,
      reason: "component-library and preset choices depend on the target project",
    });
  });

  it("blocks cwd from creating outside the selected target", () => {
    expect(() =>
      resolveManagedCliPlans({
        manifests: [shadcnCliManifest],
        options: options(["shadcn"]),
        packageManager: "npm",
        selectedToolchains: [shadcn],
        userFlags: { shadcn: { cwd: "../other-project" } },
        yes: false,
      }),
    ).toThrow("--shadcn.cwd is blocked");
  });

  it("runs the interactive command through its generated manifest", async () => {
    const command = resolveCliCommand(shadcnCliManifest, "init", "npm");
    const toolchainOptions = options(["shadcn"]);

    await runExternalToolchains(".", "npm", toolchainOptions, false);

    expect(command).toEqual({
      bin: "npx",
      args: [`shadcn@${shadcnCliManifest.version}`, "init"],
    });
    expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args, {
      stdin: "inherit",
    });

    await expect(runExternalToolchains(".", "npm", toolchainOptions, true)).rejects.toThrow(
      "initializer is interactive",
    );
    expect(mocks.runCommand).toHaveBeenCalledTimes(1);
  });
});
