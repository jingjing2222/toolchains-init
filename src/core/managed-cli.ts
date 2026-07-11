import type {
  CliCommandContract,
  CliCommandManifest,
  CliFlagContract,
} from "./cli-command-manifest";
import { resolveCliCommand } from "./cli-command-manifest";
import type { PackageManager } from "./package-manager";
import type { ManagedCliFlagValues, ToolchainAdapter } from "./toolchain-adapter";
import { getToolchainCliTool, getToolchainId } from "./toolchain-adapter";
import { cliCommandManifests, toolchains } from "../stacks/index";

export const reservedDirectSelectors = new Set([
  "help",
  "package-manager",
  "target",
  "version",
  "yes",
]);

export type ManagedCliSurfaceFlag = {
  cliName: string;
  contract: CliFlagContract;
  logicalName: string;
  optionName: string;
};

export type ManagedCliGroup = {
  command: CliCommandContract | null;
  flags: readonly ManagedCliSurfaceFlag[];
  manifest: CliCommandManifest | null;
  rawArgOptionName: string | null;
  selector: string;
  toolchain: ToolchainAdapter;
};

export type ManagedCliSurface = {
  byOptionName: ReadonlyMap<string, ManagedCliSurfaceFlag & { group: ManagedCliGroup }>;
  byRawArgOptionName: ReadonlyMap<string, ManagedCliGroup>;
  bySelector: ReadonlyMap<string, ManagedCliGroup>;
  groups: readonly ManagedCliGroup[];
};

export type ManagedCliUserFlags = Readonly<Record<string, ManagedCliFlagValues | undefined>>;

export type ManagedCliUserRawArgs = Readonly<Record<string, readonly string[] | undefined>>;

export type ManagedCliPlan = {
  command: {
    args: readonly string[];
    bin: string;
  };
  feature: ToolchainAdapter["feature"];
  selector: string;
};

export type ManagedCliPlans = ReadonlyMap<ToolchainAdapter["feature"], ManagedCliPlan>;

export function createManagedCliSurface(
  adapters: readonly ToolchainAdapter[] = toolchains as readonly ToolchainAdapter[],
  manifests: readonly CliCommandManifest[] = cliCommandManifests,
): ManagedCliSurface {
  const groups: ManagedCliGroup[] = [];
  const bySelector = new Map<string, ManagedCliGroup>();
  const byOptionName = new Map<string, ManagedCliSurfaceFlag & { group: ManagedCliGroup }>();
  const byRawArgOptionName = new Map<string, ManagedCliGroup>();
  const manifestsByTool = new Map<string, CliCommandManifest>();
  for (const manifest of manifests) {
    if (manifestsByTool.has(manifest.tool)) {
      throw new Error(`Duplicate CLI manifest selector: ${manifest.tool}`);
    }
    manifestsByTool.set(manifest.tool, manifest);
  }

  const seenFeatures = new Set<ToolchainAdapter["feature"]>();

  for (const toolchain of adapters) {
    if (seenFeatures.has(toolchain.feature)) {
      throw new Error(`Duplicate toolchain feature: ${toolchain.feature}`);
    }
    seenFeatures.add(toolchain.feature);
    const selector =
      toolchain.cli == null ? getToolchainId(toolchain) : getToolchainCliTool(toolchain);
    assertDirectSelector(selector);
    if (bySelector.has(selector)) {
      throw new Error(`Duplicate direct CLI selector: ${selector}`);
    }

    const manifest = toolchain.cli == null ? null : (manifestsByTool.get(selector) ?? null);
    if (toolchain.cli != null && manifest == null) {
      throw new Error(`CLI adapter ${selector} has no generated manifest.`);
    }
    let command: CliCommandContract | null = null;
    const flags: ManagedCliSurfaceFlag[] = [];
    if (toolchain.managedCli === true) {
      if (toolchain.cli == null || manifest == null) {
        throw new Error(`Managed CLI adapter ${selector} has no generated manifest.`);
      }
      const commandId = toolchain.cli.commandId ?? toolchain.cli.command;
      command = manifest.commands.find((candidate) => candidate.id === commandId) ?? null;
      if (command == null) {
        throw new Error(`Managed CLI adapter ${selector} has no command contract: ${commandId}`);
      }

      const seenCliNames = new Set<string>();
      for (const [logicalName, contract] of Object.entries(command.flags ?? {})) {
        if (seenCliNames.has(contract.cliName)) {
          throw new Error(
            `Duplicate CLI flag name in ${selector}/${command.id}: ${contract.cliName}`,
          );
        }
        seenCliNames.add(contract.cliName);
        if (!contract.supported) {
          continue;
        }
        if (!/^--[A-Za-z0-9][A-Za-z0-9-]*$/.test(contract.cliName)) {
          throw new Error(
            `Managed CLI flag must use a long option in ${selector}/${command.id}: ${contract.cliName}`,
          );
        }
        const optionName = `${selector}.${contract.cliName.slice(2)}`;
        flags.push({
          cliName: contract.cliName,
          contract,
          logicalName,
          optionName,
        });
      }
    }

    const rawArgOptionName = toolchain.managedCli === true ? `${selector}.raw.arg` : null;
    const group: ManagedCliGroup = {
      command,
      flags,
      manifest,
      rawArgOptionName,
      selector,
      toolchain,
    };
    groups.push(group);
    bySelector.set(selector, group);
    for (const flag of flags) {
      if (byOptionName.has(flag.optionName)) {
        throw new Error(`Duplicate managed CLI option: --${flag.optionName}`);
      }
      byOptionName.set(flag.optionName, { ...flag, group });
    }
    if (rawArgOptionName != null) {
      byRawArgOptionName.set(rawArgOptionName, group);
    }
  }

  return { byOptionName, byRawArgOptionName, bySelector, groups };
}

export function resolveManagedCliPlans({
  manifests = cliCommandManifests,
  packageManager,
  selectedToolchains,
  userFlags = {},
  userRawArgs = {},
}: {
  manifests?: readonly CliCommandManifest[];
  packageManager: PackageManager;
  selectedToolchains: readonly ToolchainAdapter[];
  userFlags?: ManagedCliUserFlags;
  userRawArgs?: ManagedCliUserRawArgs;
}): ManagedCliPlans {
  const selectedFeatures = new Set(selectedToolchains.map((toolchain) => toolchain.feature));
  validateSelectedInputKeys(selectedFeatures, userFlags, "arguments");
  validateSelectedInputKeys(selectedFeatures, userRawArgs, "raw arguments");

  const surface = createManagedCliSurface(selectedToolchains, manifests);
  const plans = new Map<ToolchainAdapter["feature"], ManagedCliPlan>();
  for (const group of surface.groups) {
    const requested = userFlags[group.toolchain.feature] ?? {};
    const rawArgs = userRawArgs[group.toolchain.feature] ?? [];
    if (group.toolchain.managedCli !== true) {
      if (Object.keys(requested).length > 0 || rawArgs.length > 0) {
        throw new Error(`Toolchain --${group.selector} does not run a managed CLI command.`);
      }
      continue;
    }
    if (group.manifest == null || group.command == null || group.toolchain.cli == null) {
      throw new Error(`Managed CLI adapter ${group.selector} is missing its command contract.`);
    }

    for (const logicalName of Object.keys(requested)) {
      if (!group.flags.some((flag) => flag.logicalName === logicalName)) {
        throw new Error(`Unknown managed CLI flag for --${group.selector}: ${logicalName}`);
      }
    }

    const resolved = resolveCliCommand(group.manifest, group.command.id, packageManager, requested);
    plans.set(group.toolchain.feature, {
      command: { ...resolved, args: [...resolved.args, ...rawArgs] },
      feature: group.toolchain.feature,
      selector: group.selector,
    });
  }

  return plans;
}

function validateSelectedInputKeys(
  selectedFeatures: ReadonlySet<string>,
  values: Readonly<Record<string, unknown>>,
  label: string,
) {
  for (const feature of Object.keys(values)) {
    if (!selectedFeatures.has(feature)) {
      throw new Error(`Managed CLI ${label} were provided for an unselected toolchain: ${feature}`);
    }
  }
}

function assertDirectSelector(selector: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selector)) {
    throw new Error(`Direct CLI selector must use lowercase kebab-case: ${selector}`);
  }
  if (reservedDirectSelectors.has(selector)) {
    throw new Error(`Direct CLI selector is reserved: ${selector}`);
  }
}
