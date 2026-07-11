import { parseArgs } from "node:util";
import type { PackageManager } from "./package-manager";
import type { Feature } from "./types";
import type { ToolchainAdapter } from "./toolchain-adapter";
import {
  createManagedCliSurface,
  type ManagedCliGroup,
  type ManagedCliUserFlags,
  type ManagedCliUserRawArgs,
} from "./managed-cli";
import { toolchains } from "../stacks/index";

export type InitCliOptions = {
  help: boolean;
  helpTool: string | null;
  managedCliFlags: ManagedCliUserFlags;
  managedCliRawArgs: ManagedCliUserRawArgs;
  packageManager: PackageManager | null;
  selectedFeatures: readonly Feature[] | null;
  target: string | null;
  version: boolean;
  yes: boolean;
};

const packageManagers = ["npm", "pnpm", "yarn", "bun", "deno"] as const;

type ParseOption = {
  multiple?: boolean;
  short?: string;
  type: "boolean" | "string";
};

type ParsedValue = boolean | string | string[] | undefined;

export function parseCliOptions(args: string[]): InitCliOptions {
  const surface = createManagedCliSurface();
  const options: Record<string, ParseOption> = {
    help: { short: "h", type: "boolean" },
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
    if (group.rawArgOptionName != null) {
      options[group.rawArgOptionName] = { multiple: true, type: "string" };
    }
  }

  const parsed = parseArgs({
    allowPositionals: true,
    args: normalizeRawArgTokens(args, surface.byRawArgOptionName),
    options,
    strict: true,
    tokens: true,
  });
  const values = parsed.values as Record<string, ParsedValue>;
  if (parsed.positionals[0] != null) {
    throw new Error(`Unknown argument: ${parsed.positionals[0]}`);
  }
  const counts = new Map<string, number>();
  for (const token of parsed.tokens) {
    if (token.kind !== "option" || options[token.name]?.multiple === true) {
      continue;
    }
    const count = (counts.get(token.name) ?? 0) + 1;
    counts.set(token.name, count);
    if (count > 1) {
      throw new Error(`Duplicate option: --${token.name}.`);
    }
  }

  const directGroups = parsed.tokens.flatMap((token) => {
    if (token.kind !== "option") {
      return [];
    }
    const group = surface.bySelector.get(token.name);
    return group == null ? [] : [group];
  });
  const help = values.help === true;
  const version = values.version === true;
  if (help || version) {
    return {
      help,
      helpTool: help && directGroups.length === 1 ? (directGroups[0]?.selector ?? null) : null,
      managedCliFlags: {},
      managedCliRawArgs: {},
      packageManager: null,
      selectedFeatures: null,
      target: null,
      version,
      yes: false,
    };
  }

  const selectedSelectors = new Set(directGroups.map((group) => group.selector));
  const managedCliFlags: Record<string, Record<string, boolean | string>> = {};
  for (const token of parsed.tokens) {
    if (token.kind !== "option") {
      continue;
    }
    const optionName = token.name;
    const entry = surface.byOptionName.get(optionName);
    if (entry == null) {
      continue;
    }
    const value = values[optionName];
    if (value == null) {
      continue;
    }
    if (!selectedSelectors.has(entry.group.selector)) {
      throw new Error(
        `Option --${optionName} requires the --${entry.group.selector} tool selector.`,
      );
    }
    if (Array.isArray(value)) {
      throw new Error(`Invalid repeated value for --${optionName}.`);
    }
    if (entry.contract.type === "enum" && !entry.contract.values.includes(String(value))) {
      throw new Error(
        `Invalid value for --${optionName}: ${String(value)}. Expected one of: ${entry.contract.values.join(", ")}.`,
      );
    }
    const featureFlags = (managedCliFlags[entry.group.toolchain.feature] ??= {});
    featureFlags[entry.logicalName] = value;
  }

  const managedCliRawArgs: Record<string, readonly string[]> = {};
  for (const [optionName, group] of surface.byRawArgOptionName) {
    const value = values[optionName];
    if (value == null) {
      continue;
    }
    if (!selectedSelectors.has(group.selector)) {
      throw new Error(`Option --${optionName} requires the --${group.selector} tool selector.`);
    }
    if (!Array.isArray(value)) {
      throw new Error(`Invalid raw argument for --${group.selector}.`);
    }
    managedCliRawArgs[group.toolchain.feature] = value;
  }

  if (values.yes === true && directGroups.length === 0) {
    throw new Error("The --yes option requires at least one direct --<tool> selector.");
  }

  return {
    help,
    helpTool: null,
    managedCliFlags,
    managedCliRawArgs,
    packageManager: parsePackageManager(values["package-manager"]),
    selectedFeatures:
      directGroups.length > 0 ? directGroups.map((group) => group.toolchain.feature) : null,
    target: parseNonEmptyValue(values.target, "target directory"),
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
      const declaredPackageManagers = group.toolchain.cli?.packageManagers;
      const packageManagerSupport =
        declaredPackageManagers != null && declaredPackageManagers.length < packageManagers.length
          ? ` [package managers: ${declaredPackageManagers.join(", ")}]`
          : "";
      const details = `${[group.toolchain.label, group.toolchain.hint]
        .filter(Boolean)
        .join(" — ")}${packageManagerSupport}`;
      return `  ${selector}  ${details}`;
    })
    .join("\n");

  return `toolchains-init ${packageVersion}

Usage:
  toolchains-init [--target path] [--<tool> ...] [options]

Options:
  --<tool>                 Select an upstream CLI command (see Tool selectors)
  --<tool>.<flag>          Forward a generated, typed upstream flag
  --<tool>.raw.arg <value> Forward one raw argument; repeat to preserve raw argument order
  --target <path>          Working directory for upstream CLIs (default: current directory)
  --package-manager <name> npm, pnpm, yarn, bun, or deno (default: launcher)
  -y, --yes                Skip wrapper selection prompts (requires explicit tool selectors)
  -h, --help               Show wrapper help; combine with one --<tool> for its arguments
  -v, --version            Show the wrapper version

Tool selectors:
${toolchainRows}

Examples:
  toolchains-init --playwright --playwright.lang=TypeScript --oxlint --yes
  toolchains-init --playwright --help
  toolchains-init --playwright --playwright.raw.arg=--help --yes
`;
}

function renderFocusedHelp(packageVersion: string, group: ManagedCliGroup) {
  const packageLabel =
    group.manifest == null
      ? (group.toolchain.cli?.package ?? "upstream CLI")
      : `${group.manifest.package}@${group.manifest.version}`;
  const rows = group.flags.map((flag) => {
    const value = formatFlagValue(flag.contract);
    return `  --${flag.optionName}${value}  forwards ${flag.cliName}`;
  });
  const argumentsSection =
    rows.length > 0
      ? rows.join("\n")
      : "  No generated typed flags were discovered for this command.";
  const rawArg = group.rawArgOptionName ?? `${group.selector}.raw.arg`;

  return `toolchains-init ${packageVersion}

Tool: --${group.selector}
Package: ${packageLabel}

Usage:
  toolchains-init --${group.selector} [--${group.selector}.<flag> ...] [--${rawArg} <value> ...] [options]

Namespaced upstream flags:
${argumentsSection}

Raw passthrough:
  --${rawArg} <value>  forwards one argument exactly; repeat for multiple arguments

Generated help and version flags are forwarded like every other upstream argument.
Use --${rawArg}=--help or --${rawArg}=--version when either flag is not in the generated list.
Boolean flags use presence-only syntax. Enum values are exact and case-sensitive.
`;
}

function normalizeRawArgTokens(
  args: readonly string[],
  rawOptions: ReadonlyMap<string, ManagedCliGroup>,
) {
  const normalized: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    const optionName = token.startsWith("--") ? token.slice(2) : "";
    if (!rawOptions.has(optionName)) {
      normalized.push(token);
      continue;
    }

    const value = args[index + 1];
    if (value == null) {
      throw new Error(`Option ${token} requires an argument.`);
    }
    normalized.push(`${token}=${value}`);
    index += 1;
  }
  return normalized;
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

function parsePackageManager(value: ParsedValue): PackageManager | null {
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

function parseNonEmptyValue(value: ParsedValue, label: string) {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  throw new Error(`Invalid ${label}.`);
}
