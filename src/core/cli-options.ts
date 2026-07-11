import { parseArgs } from "node:util";
import type { PackageManager } from "./package-manager";
import type { Feature } from "./types";
import type { ToolchainAdapter } from "./toolchain-adapter";
import {
  createManagedCliSurface,
  type ManagedCliGroup,
  type ManagedCliSurface,
  type ManagedCliUserArgs,
} from "./managed-cli";
import { toolchains } from "../stacks/index";

export type InitCliOptions = {
  help: boolean;
  helpTool: string | null;
  managedCliArgs: ManagedCliUserArgs;
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
  }

  const preprocessed = preprocessManagedCliArgs(args, surface);

  const parsed = parseArgs({
    allowPositionals: true,
    args: preprocessed.wrapperArgs,
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
      managedCliArgs: {},
      packageManager: null,
      selectedFeatures: null,
      target: null,
      version,
      yes: false,
    };
  }

  const selectedSelectors = new Set(directGroups.map((group) => group.selector));
  for (const group of preprocessed.groupsWithArgs) {
    if (!selectedSelectors.has(group.selector)) {
      throw new Error(
        `Origin arguments for --${group.selector} require the --${group.selector} tool selector.`,
      );
    }
  }

  if (values.yes === true && directGroups.length === 0) {
    throw new Error("The --yes option requires at least one direct --<tool> selector.");
  }

  return {
    help,
    helpTool: null,
    managedCliArgs: preprocessed.managedCliArgs,
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
  --<tool>.<flag>          Forward an upstream flag without validating it
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
    return `  --${flag.optionName}  forwards ${flag.cliName}`;
  });
  const argumentsSection =
    rows.length > 0
      ? rows.join("\n")
      : "  No flag names were discovered from this command's help output.";
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

Discovered names are help only; any --${group.selector}.<flag> name is accepted.
The wrapper removes only the --${group.selector}. namespace and does not validate names, values, or repetitions.
Use =value or an adjacent non-option value. Use --${rawArg} for arbitrary tokens such as --, positionals, or dash-prefixed values.
For example, --${rawArg}=--version forwards --version to the origin CLI.
`;
}

function preprocessManagedCliArgs(args: readonly string[], surface: ManagedCliSurface) {
  const wrapperArgs: string[] = [];
  const managedCliArgs: Record<string, string[]> = {};
  const groupsWithArgs = new Set<ManagedCliGroup>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    const namespaced = matchManagedCliToken(token, surface);
    if (namespaced == null) {
      wrapperArgs.push(token);
      continue;
    }

    const { group, suffix } = namespaced;
    const destination = (managedCliArgs[group.toolchain.feature] ??= []);
    groupsWithArgs.add(group);

    if (suffix === "raw.arg") {
      const value = args[index + 1];
      if (value == null) {
        throw new Error(`Option ${token} requires an argument.`);
      }
      destination.push(value);
      index += 1;
      continue;
    }
    if (suffix.startsWith("raw.arg=")) {
      destination.push(suffix.slice("raw.arg=".length));
      continue;
    }

    const separatorIndex = suffix.indexOf("=");
    destination.push(`--${suffix}`);

    const adjacentValue = args[index + 1];
    if (separatorIndex === -1 && adjacentValue != null && !adjacentValue.startsWith("-")) {
      destination.push(adjacentValue);
      index += 1;
    }
  }

  return { groupsWithArgs, managedCliArgs, wrapperArgs };
}

function matchManagedCliToken(token: string, surface: ManagedCliSurface) {
  if (!token.startsWith("--")) {
    return null;
  }

  const body = token.slice(2);
  const dotIndex = body.indexOf(".");
  if (dotIndex === -1) {
    return null;
  }
  const group = surface.bySelector.get(body.slice(0, dotIndex));
  if (group?.rawArgOptionName == null) {
    return null;
  }
  return { group, suffix: body.slice(dotIndex + 1) };
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
