import type { CliCommandContract, CliCommandManifest } from "./cli-command-manifest";
import { assertDirectSelector } from "./cli-contract";
import type { ToolchainDefinition } from "./toolchain-adapter";
import { cliCommandManifests, toolchains } from "../stacks/index";

export { reservedDirectSelectors } from "./cli-contract";

export type ToolchainCliSurfaceFlag = {
  cliName: string;
  optionName: string;
};

export type ToolchainCliGroup = {
  command: CliCommandContract;
  flags: readonly ToolchainCliSurfaceFlag[];
  manifest: CliCommandManifest;
  rawArgOptionName: string;
  selector: string;
  toolchain: ToolchainDefinition;
};

export type ToolchainCliSurface = {
  bySelector: ReadonlyMap<string, ToolchainCliGroup>;
  groups: readonly ToolchainCliGroup[];
};

export type ToolchainCliUserArgs = Readonly<Record<string, readonly string[] | undefined>>;

export function createToolchainCliSurface(
  definitions: readonly ToolchainDefinition[] = toolchains,
  manifests: readonly CliCommandManifest[] = cliCommandManifests,
): ToolchainCliSurface {
  const groups: ToolchainCliGroup[] = [];
  const bySelector = new Map<string, ToolchainCliGroup>();
  const manifestsByTool = new Map<string, CliCommandManifest>();

  for (const manifest of manifests) {
    if (manifestsByTool.has(manifest.tool)) {
      throw new Error(`Duplicate CLI manifest selector: ${manifest.tool}`);
    }
    manifestsByTool.set(manifest.tool, manifest);
  }

  for (const toolchain of definitions) {
    assertDirectSelector(toolchain.id);
    if (bySelector.has(toolchain.id)) {
      throw new Error(`Duplicate direct CLI selector: ${toolchain.id}`);
    }

    const manifest = manifestsByTool.get(toolchain.id);
    if (manifest == null) {
      throw new Error(`CLI adapter ${toolchain.id} has no generated manifest.`);
    }
    const commandId = toolchain.origin.commandId ?? toolchain.origin.command;
    const command = manifest.commands.find((candidate) => candidate.id === commandId);
    if (command == null) {
      throw new Error(`CLI adapter ${toolchain.id} has no command contract: ${commandId}`);
    }

    const seenCliNames = new Set<string>();
    const flags = Object.values(command.flags ?? {}).map((contract) => {
      if (seenCliNames.has(contract.cliName)) {
        throw new Error(
          `Duplicate CLI flag name in ${toolchain.id}/${command.id}: ${contract.cliName}`,
        );
      }
      seenCliNames.add(contract.cliName);
      return {
        cliName: contract.cliName,
        optionName: `${toolchain.id}.${contract.cliName.slice(2)}`,
      };
    });

    const group: ToolchainCliGroup = {
      command,
      flags,
      manifest,
      rawArgOptionName: `${toolchain.id}.raw.arg`,
      selector: toolchain.id,
      toolchain,
    };
    groups.push(group);
    bySelector.set(group.selector, group);
  }

  return { bySelector, groups };
}
