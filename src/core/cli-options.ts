import { parseArgs } from "node:util";
import type { PackageManager } from "./package-manager";
import type { Feature } from "./types";
import { getToolchainCliTool } from "./toolchain-adapter";
import type { ToolchainAdapter, ToolchainOptionOverrides } from "./toolchain-adapter";
import {
  createManagedCliSurface,
  getManagedCliFlagPolicy,
  type ManagedCliGroup,
  type ManagedCliUserFlags,
} from "./managed-cli";
import { toolchains } from "../stacks/index";

export type InitCliOptions = {
  help: boolean;
  helpTool: string | null;
  managedCliFlags: ManagedCliUserFlags;
  packageManager: PackageManager | null;
  selectedFeatures: readonly Feature[] | null;
  skipInstall: boolean;
  target: string | null;
  toolchainOptions: ToolchainOptionOverrides;
  version: boolean;
  yes: boolean;
};

const packageManagers = ["npm", "pnpm", "yarn", "bun", "deno"] as const;

type ParseOption = {
  short?: string;
  type: "boolean" | "string";
};

export function parseCliOptions(args: string[]): InitCliOptions {
  const surface = createManagedCliSurface();
  const options: Record<string, ParseOption> = {
    help: { short: "h", type: "boolean" },
    "no-install": { type: "boolean" },
    "package-manager": { type: "string" },
    target: { type: "string" },
    version: { short: "v", type: "boolean" },
    yes: { short: "y", type: "boolean" },
  };
  for (const group of surface.groups) {
    options[group.selector] = { type: "boolean" };
    for (const flag of group.flags) {
      options[flag.optionName] = {
        type: flag.contract.type === "boolean" ? "boolean" : "string",
      };
    }
    for (const entry of group.setup) {
      options[entry.optionName] = { type: "string" };
    }
  }

  const parsed = parseArgs({
    allowPositionals: true,
    args,
    options,
    strict: true,
    tokens: true,
  });
  const values = parsed.values as Record<string, boolean | string | undefined>;
  if (parsed.positionals[0] != null) {
    throw new Error(`Unknown argument: ${parsed.positionals[0]}`);
  }
  const counts = new Map<string, number>();
  for (const token of parsed.tokens) {
    if (token.kind !== "option") {
      continue;
    }
    const count = (counts.get(token.name) ?? 0) + 1;
    counts.set(token.name, count);
    if (count > 1) {
      throw new Error(`Duplicate option: --${token.name}.`);
    }
  }

  const directGroups = surface.groups.filter((group) => values[group.selector] === true);
  const help = values.help === true;
  const version = values.version === true;
  if (help || version) {
    return {
      help,
      helpTool: help && directGroups.length === 1 ? (directGroups[0]?.selector ?? null) : null,
      managedCliFlags: {},
      packageManager: null,
      selectedFeatures: null,
      skipInstall: false,
      target: null,
      toolchainOptions: {},
      version,
      yes: false,
    };
  }

  const selectedSelectors = new Set(directGroups.map((group) => group.selector));
  const managedCliFlags: Record<string, Record<string, boolean | string>> = {};
  for (const [optionName, entry] of surface.byOptionName) {
    const value = values[optionName];
    if (value == null) {
      continue;
    }
    if (!selectedSelectors.has(entry.group.selector)) {
      throw new Error(
        `Option --${optionName} requires the --${entry.group.selector} tool selector.`,
      );
    }
    if (entry.contract.type === "enum" && !entry.contract.values.includes(String(value))) {
      throw new Error(
        `Invalid value for --${optionName}: ${String(value)}. Expected one of: ${entry.contract.values.join(", ")}.`,
      );
    }
    if (entry.contract.type === "string" && value === "") {
      throw new Error(`Invalid empty value for --${optionName}.`);
    }
    const featureFlags = (managedCliFlags[entry.group.toolchain.feature] ??= {});
    featureFlags[entry.logicalName] = value;
  }

  const toolchainOptions: ToolchainOptionOverrides = {};
  for (const [optionName, entry] of surface.bySetupOptionName) {
    const value = values[optionName];
    if (value == null) {
      continue;
    }
    if (!selectedSelectors.has(entry.group.selector)) {
      throw new Error(
        `Option --${optionName} requires the --${entry.group.selector} tool selector.`,
      );
    }
    if (
      typeof value !== "string" ||
      !entry.contract.values.some((candidate) => candidate === value)
    ) {
      throw new Error(
        `Invalid value for --${optionName}: ${String(value)}. Expected one of: ${entry.contract.values.join(", ")}.`,
      );
    }
    if (Object.hasOwn(toolchainOptions, entry.contract.option)) {
      throw new Error(`Multiple setup options target toolchain option: ${entry.contract.option}`);
    }
    Object.assign(toolchainOptions, { [entry.contract.option]: value });
  }

  const skipInstall = values["no-install"] === true;
  if (
    skipInstall &&
    (Object.keys(managedCliFlags).length > 0 || Object.keys(toolchainOptions).length > 0)
  ) {
    throw new Error("Managed initializer arguments cannot be combined with --no-install.");
  }
  if (values.yes === true && directGroups.length === 0) {
    throw new Error("The --yes option requires at least one direct --<tool> selector.");
  }

  return {
    help,
    helpTool: null,
    managedCliFlags,
    packageManager: parsePackageManager(values["package-manager"]),
    selectedFeatures:
      directGroups.length > 0 ? directGroups.map((group) => group.toolchain.feature) : null,
    skipInstall,
    target: parseNonEmptyValue(values.target, "target directory"),
    toolchainOptions,
    version,
    yes: values.yes === true,
  };
}

export function renderHelp(packageVersion: string, focusedSelector: string | null = null) {
  const registeredToolchains = toolchains as readonly ToolchainAdapter[];
  const surface = createManagedCliSurface(registeredToolchains);
  if (focusedSelector != null) {
    const group = surface.bySelector.get(focusedSelector);
    if (group != null) {
      return renderFocusedHelp(packageVersion, group);
    }
  }

  const selectorWidth = Math.max(...surface.groups.map((group) => group.selector.length));
  const toolchainRows = surface.groups
    .map((group) => {
      const selector = `--${group.selector}`.padEnd(selectorWidth + 2);
      const interaction =
        group.toolchain.nonInteractive?.supported === false ? " [interactive only]" : "";
      const declaredPackageManagers = group.toolchain.cli?.packageManagers;
      const packageManagerSupport =
        declaredPackageManagers != null && declaredPackageManagers.length < packageManagers.length
          ? ` [package managers: ${declaredPackageManagers.join(", ")}]`
          : "";
      const details = `${[group.toolchain.label, group.toolchain.hint]
        .filter(Boolean)
        .join(" — ")}${packageManagerSupport}${interaction}`;
      return `  ${selector}  ${details}`;
    })
    .join("\n");
  const interactiveRows = surface.groups.flatMap((group) =>
    group.toolchain.nonInteractive?.supported === false
      ? [`  --${group.selector.padEnd(selectorWidth)}  ${group.toolchain.nonInteractive.reason}`]
      : [],
  );

  return `toolchains-init ${packageVersion}

Usage:
  toolchains-init [--target path] [--<tool> ...] [options]

Options:
  --<tool>                 Select a tool directly (see Tool selectors)
  --<tool>.<flag>          Forward a generated upstream flag to that tool
  --target <path>          Target project directory (default: current directory)
  --package-manager <name> npm, pnpm, yarn, bun, or deno (default: launcher)
  -y, --yes                Accept defaults/overwrites (requires explicit tool selectors)
  --no-install             Skip dependency installs and official initializers
  -h, --help               Show this help; combine with one --<tool> for its flags
  -v, --version            Show the package version

Non-interactive rules:
  --yes fails before setup if a selected initializer is marked interactive-only.
  Generated flags are namespaced because upstream CLIs reuse names such as --yes and --help.

Tool selectors:
${toolchainRows}
${interactiveRows.length > 0 ? `\nInteractive-only initializers:\n${interactiveRows.join("\n")}` : ""}

Examples:
  toolchains-init --playwright --playwright.lang=TypeScript --oxlint --yes
  toolchains-init --playwright --help
  toolchains-init --knip --react-doctor --yes --no-install
`;
}

export function validateNonInteractiveToolchains(
  selectedToolchains: readonly ToolchainAdapter[],
  nonInteractive: boolean,
) {
  if (!nonInteractive) {
    return [];
  }

  const unsupported = selectedToolchains.filter(
    (toolchain) => toolchain.nonInteractive?.supported === false,
  );
  return unsupported.length === 0
    ? []
    : [
        `Interactive-only toolchains cannot be combined with --yes:\n${unsupported
          .map(
            (toolchain) =>
              `  ${getToolchainCliTool(toolchain)}: ${toolchain.nonInteractive?.reason ?? "interactive input required"}`,
          )
          .join("\n")}`,
      ];
}

function renderFocusedHelp(packageVersion: string, group: ManagedCliGroup) {
  const packageLabel =
    group.manifest == null
      ? (group.toolchain.cli?.package ?? "built-in setup")
      : `${group.manifest.package}@${group.manifest.version}`;
  const packageManager = group.toolchain.cli?.packageManagers?.[0] ?? "npm";
  const context = {
    options: { features: [group.toolchain.feature], routerMode: "file" as const },
    packageManager,
    yes: true,
  };
  const setupRows = group.setup.map(
    (entry) =>
      `  --${entry.optionName}${formatSetupValue(entry.contract)}  ${entry.contract.description}`,
  );
  const rows: string[] = [];
  for (const flag of group.flags) {
    const value = formatFlagValue(flag.contract);
    const policy = getManagedCliFlagPolicy(group, flag, context);
    const status =
      policy.blockedReason != null
        ? ` [blocked: ${policy.blockedReason}]`
        : policy.lockedValue !== undefined
          ? ` [locked under --yes: ${JSON.stringify(policy.lockedValue)}]`
          : policy.defaultValue !== undefined
            ? ` [default under --yes: ${JSON.stringify(policy.defaultValue)}]`
            : "";
    rows.push(`  --${flag.optionName}${value}  forwards ${flag.cliName}${status}`);
  }
  const argumentsSection =
    rows.length > 0 ? rows.join("\n") : "  No managed initializer flags are exposed for this tool.";
  const setupSection =
    setupRows.length > 0 ? `\nTool setup options:\n${setupRows.join("\n")}\n` : "";
  const interaction =
    group.toolchain.nonInteractive?.supported === false
      ? `\nInteraction: interactive only — ${group.toolchain.nonInteractive.reason}`
      : "";

  return `toolchains-init ${packageVersion}

Tool: --${group.selector}
Package: ${packageLabel}${interaction}

Usage:
  toolchains-init --${group.selector} [--${group.selector}.<flag> ...] [options]
${setupSection}
Generated upstream flags:
${argumentsSection}

Global options such as --yes, --package-manager, --target, and --no-install are never forwarded.
Boolean flags use presence-only syntax. Enum values are exact and case-sensitive.
Positionals, repeatable flags, and raw -- passthrough are not accepted by the current manifest schema.
`;
}

function formatFlagValue(contract: ManagedCliGroup["flags"][number]["contract"]) {
  if (contract.type === "boolean") {
    return "";
  }
  if (contract.type === "enum") {
    return ` <${contract.values.join("|")}>`;
  }
  return " <value>";
}

function formatSetupValue(contract: ManagedCliGroup["setup"][number]["contract"]) {
  return ` <${contract.values.join("|")}>`;
}

function parsePackageManager(value: boolean | string | undefined): PackageManager | null {
  if (value == null) {
    return null;
  }
  if (
    typeof value === "string" &&
    packageManagers.some((packageManager) => packageManager === value)
  ) {
    return value as PackageManager;
  }
  throw new Error(
    `Invalid package manager: ${String(value)}. Expected one of: ${packageManagers.join(", ")}.`,
  );
}

function parseNonEmptyValue(value: boolean | string | undefined, label: string) {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(`Invalid ${label}.`);
}
