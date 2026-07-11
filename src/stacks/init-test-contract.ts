import { beforeEach, describe, expect, it } from "vitest";
import type { CliCommandManifest } from "../core/cli-command-manifest";
import { parseCliOptions } from "../core/cli-options";
import { executePlan } from "../core/execute-plan";
import { buildExecutionPlan } from "../core/execution-plan";
import type { PackageManager } from "../core/package-manager";
import type { ToolchainDefinition } from "../core/toolchain-adapter";

type OriginBoundaryMock = {
  mockClear(): void;
};

export function defineFocusedInitContract({
  baseCommand,
  expectedMetadata,
  manifest,
  packageManager,
  runCommandMock,
  toolchain,
}: {
  baseCommand: { bin: string; args: readonly string[] };
  expectedMetadata: Pick<ToolchainDefinition, "id" | "area" | "capabilities"> & {
    origin: Pick<ToolchainDefinition["origin"], "package" | "command">;
  };
  manifest: CliCommandManifest;
  packageManager: PackageManager;
  runCommandMock: OriginBoundaryMock;
  toolchain: ToolchainDefinition;
}) {
  const forwardedArgs = ["--future-option=opaque", "./raw-target", "--future-flag", "--tail"];

  describe(`${toolchain.label} focused init contract`, () => {
    beforeEach(() => {
      runCommandMock.mockClear();
    });

    it("preserves canonical metadata, ordered passthrough, and one origin execution", async () => {
      expect(toolchain).toMatchObject({
        id: expectedMetadata.id,
        area: expectedMetadata.area,
        capabilities: expectedMetadata.capabilities,
        origin: {
          package: expectedMetadata.origin.package,
          command: expectedMetadata.origin.command,
        },
      });
      expect(manifest).toMatchObject({
        tool: expectedMetadata.id,
        package: expectedMetadata.origin.package,
      });
      for (const mutationHook of [
        "afterInstall",
        "afterWrite",
        "beforeRun",
        "execute",
        "updatePackageJson",
      ]) {
        expect(toolchain).not.toHaveProperty(mutationHook);
      }

      const parsed = parseCliOptions([
        `--${toolchain.id}`,
        `--${toolchain.id}.future-option=opaque`,
        `--${toolchain.id}.raw.arg=./raw-target`,
        `--${toolchain.id}.future-flag`,
        `--${toolchain.id}.raw.arg=--tail`,
      ]);
      expect(parsed.selectedToolIds).toEqual([toolchain.id]);
      expect(parsed.originArgs).toEqual({ [toolchain.id]: forwardedArgs });

      const plan = buildExecutionPlan({
        cwd: "/workspace",
        packageManager,
        selectedToolchains: [toolchain],
        manifests: [manifest],
        userArgs: parsed.originArgs,
      });
      const command = {
        bin: baseCommand.bin,
        args: [...baseCommand.args, ...forwardedArgs],
      };
      expect(plan.steps).toEqual([
        expect.objectContaining({
          id: toolchain.id,
          packageName: toolchain.origin.package,
          packageVersion: manifest.version,
          command,
        }),
      ]);

      await executePlan(plan);

      expect(runCommandMock).toHaveBeenCalledOnce();
      expect(runCommandMock).toHaveBeenCalledWith("/workspace", command.bin, command.args);
    });
  });
}
