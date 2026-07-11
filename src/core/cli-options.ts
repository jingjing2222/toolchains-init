import { parseArgs } from "node:util";
import type { ToolchainCliGroup, ToolchainCliSurface, ToolchainCliUserArgs } from "./cli-surface";
import { createToolchainCliSurface } from "./cli-surface";
import type { PackageManager } from "./package-manager";
import { toolchains } from "../stacks/index";

export type InitCliOptions = {
  help: boolean;
  helpTool: string | null;
  originArgs: ToolchainCliUserArgs;
  packageManager: PackageManager | null;
  plan: boolean;
  selectedToolIds: readonly string[] | null;
  target: string | null;
  version: boolean;
};

const packageManagers = ["npm", "pnpm", "yarn", "bun", "deno"] as const;

type ParseOption = {
  multiple?: boolean;
  short?: string;
  type: "boolean" | "string";
};

type ParsedValue = boolean | string | string[] | undefined;

export function parseCliOptions(args: string[]): InitCliOptions {
  const surface = createToolchainCliSurface();
  const options: Record<string, ParseOption> = {
    help: { short: "h", type: "boolean" },
    "package-manager": { type: "string" },
    plan: { type: "boolean" },
    target: { type: "string" },
    version: { short: "v", type: "boolean" },
  };
  for (const group of surface.groups) {
    options[group.selector] = { type: "boolean" };
  }

  const preprocessed = preprocessOriginArgs(args, surface);
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
      originArgs: {},
      packageManager: null,
      plan: false,
      selectedToolIds: null,
      target: null,
      version,
    };
  }

  const selectedIds = new Set(directGroups.map((group) => group.selector));
  for (const group of preprocessed.groupsWithArgs) {
    if (!selectedIds.has(group.selector)) {
      throw new Error(
        `Origin arguments for --${group.selector} require the --${group.selector} tool selector.`,
      );
    }
  }

  return {
    help,
    helpTool: null,
    originArgs: preprocessed.originArgs,
    packageManager: parsePackageManager(values["package-manager"]),
    plan: values.plan === true,
    selectedToolIds: directGroups.length > 0 ? directGroups.map((group) => group.selector) : null,
    target: parseNonEmptyValue(values.target, "target directory"),
    version,
  };
}

export function renderHelp(packageVersion: string, focusedSelector: string | null = null) {
  const surface = createToolchainCliSurface(toolchains);
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
      const declaredPackageManagers = group.toolchain.origin.packageManagers;
      const packageManagerSupport =
        declaredPackageManagers != null && declaredPackageManagers.length < packageManagers.length
          ? ` [package managers: ${declaredPackageManagers.join(", ")}]`
          : "";
      return `  ${selector}  ${group.toolchain.label} — ${group.toolchain.summary}${packageManagerSupport}`;
    })
    .join("\n");

  return `toolchains-init ${packageVersion}

Usage:
  toolchains-init [--target path] [--<tool> ...] [options]

Options:
  --<tool>                 Select an upstream initializer (see Tool selectors)
  --<tool>.<flag>          Forward an upstream flag without validating it
  --<tool>.raw.arg <value> Forward one raw argument; repeat to preserve argument order
  --plan                   Print the complete execution plan without running commands
  --target <path>          Working directory for upstream CLIs (default: current directory)
  --package-manager <name> npm, pnpm, yarn, bun, or deno (default: launcher)
  -h, --help               Show wrapper help; combine with one --<tool> for its arguments
  -v, --version            Show the wrapper version

Tool selectors:
${toolchainRows}

Examples:
  toolchains-init --playwright --playwright.lang=TypeScript --biome
  toolchains-init --plan --playwright --biome
  toolchains-init --playwright --help
  toolchains-init --playwright --playwright.raw.arg=--help
`;
}

function renderFocusedHelp(packageVersion: string, group: ToolchainCliGroup) {
  const packageLabel = `${group.manifest.package}@${group.manifest.version}`;
  const rows = group.flags.map((flag) => {
    return `  --${flag.optionName}  forwards ${flag.cliName}`;
  });
  const argumentsSection =
    rows.length > 0
      ? rows.join("\n")
      : "  No flag names were discovered from this command's help output.";

  return `toolchains-init ${packageVersion}

Tool: --${group.selector}
Package: ${packageLabel}

Usage:
  toolchains-init --${group.selector} [--${group.selector}.<flag> ...] [--${group.rawArgOptionName} <value> ...] [options]

Namespaced upstream flags:
${argumentsSection}

Raw passthrough:
  --${group.rawArgOptionName} <value>  forwards one argument exactly; repeat for multiple arguments

Discovered names are help only; any --${group.selector}.<flag> name is accepted.
The wrapper removes only the --${group.selector}. namespace and does not validate names, values, or repetitions.
Use =value or an adjacent non-option value. Use --${group.rawArgOptionName} for arbitrary tokens such as --, positionals, or dash-prefixed values.
For example, --${group.rawArgOptionName}=--version forwards --version to the origin CLI.
`;
}

function preprocessOriginArgs(args: readonly string[], surface: ToolchainCliSurface) {
  const wrapperArgs: string[] = [];
  const originArgs: Record<string, string[]> = {};
  const groupsWithArgs = new Set<ToolchainCliGroup>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    const namespaced = matchOriginToken(token, surface);
    if (namespaced == null) {
      wrapperArgs.push(token);
      continue;
    }

    const { group, suffix } = namespaced;
    const destination = (originArgs[group.toolchain.id] ??= []);
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

  return { groupsWithArgs, originArgs, wrapperArgs };
}

function matchOriginToken(token: string, surface: ToolchainCliSurface) {
  if (!token.startsWith("--")) {
    return null;
  }

  const body = token.slice(2);
  const dotIndex = body.indexOf(".");
  if (dotIndex === -1) {
    return null;
  }
  const group = surface.bySelector.get(body.slice(0, dotIndex));
  if (group == null) {
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
