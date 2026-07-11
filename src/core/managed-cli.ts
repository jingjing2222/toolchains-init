import type {
  CliCommandContract,
  CliCommandManifest,
  CliFlagContract,
} from "./cli-command-manifest";
import { resolveCliCommand } from "./cli-command-manifest";
import type { PackageManager } from "./package-manager";
import type {
  ManagedCliFlagValue,
  ManagedCliFlagValues,
  ManagedCliPolicyContext,
  ManagedCliPolicyValue,
  ManagedCliSetupContract,
  ManagedToolchainCli,
  ToolchainAdapter,
} from "./toolchain-adapter";
import { getToolchainCliTool, getToolchainId } from "./toolchain-adapter";
import type { ToolchainOptions } from "./types";
import { cliCommandManifests, toolchains } from "../stacks/index";

export const reservedDirectSelectors = new Set([
  "help",
  "no-install",
  "package-manager",
  "target",
  "version",
  "yes",
]);

const universalBlockedFlags = new Map([
  ["--help", "Use focused toolchains-init help instead of forwarding upstream help."],
  ["--version", "Upstream version output does not initialize the selected toolchain."],
]);

export type ManagedCliSurfaceFlag = {
  cliName: string;
  contract: CliFlagContract;
  logicalName: string;
  optionName: string;
};

export type ManagedCliSurfaceSetup = {
  contract: ManagedCliSetupContract;
  logicalName: string;
  optionName: string;
};

export type ManagedCliGroup = {
  command: CliCommandContract | null;
  flags: readonly ManagedCliSurfaceFlag[];
  manifest: CliCommandManifest | null;
  selector: string;
  setup: readonly ManagedCliSurfaceSetup[];
  toolchain: ToolchainAdapter;
};

export type ManagedCliSurface = {
  byOptionName: ReadonlyMap<string, ManagedCliSurfaceFlag & { group: ManagedCliGroup }>;
  bySelector: ReadonlyMap<string, ManagedCliGroup>;
  bySetupOptionName: ReadonlyMap<string, ManagedCliSurfaceSetup & { group: ManagedCliGroup }>;
  groups: readonly ManagedCliGroup[];
};

export type ManagedCliUserFlags = Readonly<Record<string, ManagedCliFlagValues | undefined>>;

export type ManagedCliPlan = {
  command: {
    args: readonly string[];
    bin: string;
  };
  feature: ToolchainAdapter["feature"];
  phase: ManagedToolchainCli["phase"];
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
  const bySetupOptionName = new Map<string, ManagedCliSurfaceSetup & { group: ManagedCliGroup }>();
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
    if (toolchain.managedCli != null) {
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
        const flag = { cliName: contract.cliName, contract, logicalName, optionName };
        flags.push(flag);
      }
    }

    const setup = Object.entries(toolchain.managedCli?.setup ?? {}).map(
      ([logicalName, contract]): ManagedCliSurfaceSetup => {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(logicalName)) {
          throw new Error(`Managed CLI setup name must use lowercase kebab-case: ${logicalName}`);
        }
        if (contract.description.trim().length === 0) {
          throw new Error(
            `Managed CLI setup option needs a description: ${selector}/${logicalName}`,
          );
        }
        if (
          contract.type === "enum" &&
          (contract.values.length === 0 ||
            contract.values.some((value) => value.length === 0) ||
            new Set(contract.values).size !== contract.values.length)
        ) {
          throw new Error(`Invalid managed CLI setup enum: ${selector}/${logicalName}`);
        }
        return {
          contract,
          logicalName,
          optionName: `${selector}.setup.${logicalName}`,
        };
      },
    );
    const group: ManagedCliGroup = { command, flags, manifest, selector, setup, toolchain };
    groups.push(group);
    bySelector.set(selector, group);
    for (const flag of flags) {
      if (byOptionName.has(flag.optionName)) {
        throw new Error(`Duplicate managed CLI option: --${flag.optionName}`);
      }
      byOptionName.set(flag.optionName, { ...flag, group });
    }
    for (const entry of setup) {
      if (bySetupOptionName.has(entry.optionName)) {
        throw new Error(`Duplicate managed CLI setup option: --${entry.optionName}`);
      }
      bySetupOptionName.set(entry.optionName, { ...entry, group });
    }
  }

  return { byOptionName, bySelector, bySetupOptionName, groups };
}

export function resolveManagedCliPlans({
  manifests = cliCommandManifests,
  options,
  packageManager,
  selectedToolchains,
  userFlags = {},
  yes,
}: {
  manifests?: readonly CliCommandManifest[];
  options: ToolchainOptions;
  packageManager: PackageManager;
  selectedToolchains: readonly ToolchainAdapter[];
  userFlags?: ManagedCliUserFlags;
  yes: boolean;
}): ManagedCliPlans {
  const selectedFeatures = new Set(selectedToolchains.map((toolchain) => toolchain.feature));
  const optionFeatures = new Set(options.features);
  if (
    selectedFeatures.size !== optionFeatures.size ||
    [...selectedFeatures].some((feature) => !optionFeatures.has(feature))
  ) {
    throw new Error("Selected toolchains do not match options.features.");
  }

  const surface = createManagedCliSurface(selectedToolchains, manifests);
  for (const feature of Object.keys(userFlags)) {
    if (!selectedFeatures.has(feature)) {
      throw new Error(
        `Managed CLI arguments were provided for an unselected toolchain: ${feature}`,
      );
    }
  }

  const context = { options, packageManager, yes } satisfies ManagedCliPolicyContext;
  const plans = new Map<ToolchainAdapter["feature"], ManagedCliPlan>();
  for (const group of surface.groups) {
    const policy = group.toolchain.managedCli;
    const requested = userFlags[group.toolchain.feature] ?? {};
    if (policy == null) {
      if (Object.keys(requested).length > 0) {
        throw new Error(`Toolchain --${group.selector} does not run a managed initializer.`);
      }
      continue;
    }
    if (group.manifest == null || group.command == null) {
      throw new Error(`Managed CLI adapter ${group.selector} is missing its command contract.`);
    }

    const defaults = resolvePolicyValue(policy.defaults, context, {});
    const locked = resolvePolicyValue(policy.locked, context, {});
    const blocked = resolvePolicyValue(policy.blocked, context, {});
    const positionals = resolvePolicyValue(policy.positionals, context, []);
    const knownFlags = new Set(group.flags.map((flag) => flag.logicalName));
    validatePolicyKeys(group, knownFlags, "default", Object.keys(defaults));
    validatePolicyKeys(group, knownFlags, "locked", Object.keys(locked));
    validatePolicyKeys(group, knownFlags, "blocked", Object.keys(blocked));
    validateUniversalPolicyKeys(group, "default", Object.keys(defaults));
    validateUniversalPolicyKeys(group, "locked", Object.keys(locked));

    for (const [logicalName, value] of Object.entries(requested)) {
      const flag = group.flags.find((candidate) => candidate.logicalName === logicalName);
      if (flag == null) {
        throw new Error(`Unknown managed CLI flag for --${group.selector}: ${logicalName}`);
      }
      const blockedReason = universalBlockedFlags.get(flag.cliName) ?? blocked[logicalName];
      if (blockedReason != null) {
        throw new Error(`Option --${flag.optionName} is blocked: ${blockedReason}`);
      }
      const lockedValue = locked[logicalName];
      if (Object.hasOwn(locked, logicalName) && lockedValue !== value) {
        throw new Error(
          `Option --${flag.optionName} is locked to ${JSON.stringify(lockedValue)} by toolchains-init.`,
        );
      }
    }

    const effectiveFlags: Record<string, ManagedCliFlagValue> = {
      ...defaults,
      ...requested,
      ...locked,
    };
    const command = resolveCliCommand(
      group.manifest,
      group.command.id,
      packageManager,
      effectiveFlags,
      positionals,
    );
    plans.set(group.toolchain.feature, {
      command,
      feature: group.toolchain.feature,
      phase: policy.phase,
      selector: group.selector,
    });
  }

  return plans;
}

export function getManagedCliFlagPolicy(
  group: ManagedCliGroup,
  flag: ManagedCliSurfaceFlag,
  context: ManagedCliPolicyContext,
) {
  const policy = group.toolchain.managedCli;
  const defaults = resolvePolicyValue(policy?.defaults, context, {});
  const locked = resolvePolicyValue(policy?.locked, context, {});
  const blocked = resolvePolicyValue(policy?.blocked, context, {});
  return {
    blockedReason: universalBlockedFlags.get(flag.cliName) ?? blocked[flag.logicalName] ?? null,
    defaultValue: defaults[flag.logicalName],
    lockedValue: locked[flag.logicalName],
  };
}

function resolvePolicyValue<T>(
  value: ManagedCliPolicyValue<T> | undefined,
  context: ManagedCliPolicyContext,
  fallback: T,
) {
  return value == null
    ? fallback
    : typeof value === "function"
      ? (value as (context: ManagedCliPolicyContext) => T)(context)
      : value;
}

function validatePolicyKeys(
  group: ManagedCliGroup,
  knownFlags: ReadonlySet<string>,
  policyName: string,
  keys: readonly string[],
) {
  const unknown = keys.find((key) => !knownFlags.has(key));
  if (unknown != null) {
    throw new Error(
      `Managed CLI ${policyName} flag no longer exists in ${group.selector}/${group.command?.id}: ${unknown}`,
    );
  }
}

function validateUniversalPolicyKeys(
  group: ManagedCliGroup,
  policyName: string,
  keys: readonly string[],
) {
  const blockedFlag = group.flags.find(
    (flag) => keys.includes(flag.logicalName) && universalBlockedFlags.has(flag.cliName),
  );
  if (blockedFlag != null) {
    throw new Error(
      `Managed CLI ${policyName} cannot set universally blocked option --${blockedFlag.optionName}.`,
    );
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
