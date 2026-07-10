import { parseArgs } from "node:util";
import type { PackageManager } from "./package-manager";
import type { RouterMode } from "./types";
import { getToolchainId } from "./toolchain-adapter";
import type { ToolchainAdapter } from "./toolchain-adapter";
import { toolchains } from "../stacks";

export type RequestedToolchains = "all" | readonly string[] | null;

export type InitCliOptions = {
  help: boolean;
  packageManager: PackageManager | null;
  requestedToolchains: RequestedToolchains;
  routerMode: RouterMode | null;
  skipInstall: boolean;
  target: string | null;
  version: boolean;
  yes: boolean;
};

const packageManagers = ["npm", "pnpm", "yarn", "bun", "deno"] as const;

export function parseCliOptions(args: string[]): InitCliOptions {
  const { positionals, tokens, values } = parseArgs({
    allowPositionals: true,
    args,
    options: {
      help: { short: "h", type: "boolean" },
      "no-install": { type: "boolean" },
      "package-manager": { type: "string" },
      router: { type: "string" },
      target: { type: "string" },
      toolchains: { type: "string" },
      version: { short: "v", type: "boolean" },
      yes: { short: "y", type: "boolean" },
    },
    strict: true,
    tokens: true,
  });
  if (positionals[0] != null) {
    throw new Error(`Unknown argument: ${positionals[0]}`);
  }
  for (const name of [
    "help",
    "no-install",
    "package-manager",
    "router",
    "target",
    "toolchains",
    "version",
    "yes",
  ]) {
    if (tokens.filter((token) => token.kind === "option" && token.name === name).length > 1) {
      throw new Error(`Duplicate option: --${name}.`);
    }
  }

  const help = values.help ?? false;
  const version = values.version ?? false;
  if (help || version) {
    return {
      help,
      packageManager: null,
      requestedToolchains: null,
      routerMode: null,
      skipInstall: false,
      target: null,
      version,
      yes: false,
    };
  }

  return {
    help,
    packageManager: parsePackageManager(values["package-manager"]),
    requestedToolchains: parseRequestedToolchains(values.toolchains),
    routerMode: parseRouterMode(values.router),
    skipInstall: values["no-install"] ?? false,
    target: parseNonEmptyValue(values.target, "target directory"),
    version,
    yes: values.yes ?? false,
  };
}

export function renderHelp(packageVersion: string) {
  const registeredToolchains = toolchains as readonly ToolchainAdapter[];
  const idWidth = Math.max(
    ...registeredToolchains.map((toolchain) => getToolchainId(toolchain).length),
  );
  const toolchainRows = registeredToolchains
    .map((toolchain) => {
      const id = getToolchainId(toolchain).padEnd(idWidth);
      const interaction =
        toolchain.nonInteractive?.supported === false ? " [interactive only]" : "";
      const declaredPackageManagers = toolchain.cli?.packageManagers;
      const packageManagerSupport =
        declaredPackageManagers != null && declaredPackageManagers.length < packageManagers.length
          ? ` [package managers: ${declaredPackageManagers.join(", ")}]`
          : "";
      const details = `${[toolchain.label, toolchain.hint].filter(Boolean).join(" — ")}${packageManagerSupport}${interaction}`;
      return `  ${id}  ${details}`;
    })
    .join("\n");
  const interactiveRows = registeredToolchains.flatMap((toolchain) =>
    toolchain.nonInteractive?.supported === false
      ? [`  ${getToolchainId(toolchain).padEnd(idWidth)}  ${toolchain.nonInteractive.reason}`]
      : [],
  );

  return `toolchains-init ${packageVersion}

Usage:
  toolchains-init [--target path] [options]

Options:
  --toolchains <ids>       Comma-separated IDs, or all (including interactive-only tools)
  --target <path>          Target project directory (default: current directory)
  --package-manager <name> npm, pnpm, yarn, bun, or deno (default: launcher)
  --router file|code       TanStack Router mode (default: file)
  -y, --yes                Accept defaults/overwrites; without --toolchains, select all
  --no-install             Skip dependency installs and official initializers
  -h, --help               Show this help
  -v, --version            Show the package version

Non-interactive rules:
  --yes fails before setup if a selected initializer is marked interactive-only.
  Router code mode is interactive and cannot be combined with --yes.

Toolchains:
${toolchainRows}
${interactiveRows.length > 0 ? `\nInteractive-only initializers:\n${interactiveRows.join("\n")}` : ""}

Examples:
  toolchains-init --toolchains router,playwright,oxlint --router file --yes
  toolchains-init --target apps/web --toolchains biome,knip --yes
  toolchains-init --toolchains all
`;
}

export function getRequestedToolchainAdapters(requested: Exclude<RequestedToolchains, null>) {
  const registeredToolchains = toolchains as readonly ToolchainAdapter[];
  if (requested === "all") {
    return registeredToolchains;
  }

  const requestedIds = new Set(requested);
  return registeredToolchains.filter((toolchain) => requestedIds.has(getToolchainId(toolchain)));
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
              `  ${getToolchainId(toolchain)}: ${toolchain.nonInteractive?.reason ?? "interactive input required"}`,
          )
          .join("\n")}`,
      ];
}

function parseRequestedToolchains(value: string | undefined): RequestedToolchains {
  if (value == null) {
    return null;
  }
  if (value.length === 0) {
    throw new Error("Invalid toolchain selection. Use --toolchains <id,id> or --toolchains all.");
  }

  const ids = value.split(",").map((id) => id.trim());
  if (ids.some((id) => id.length === 0)) {
    throw new Error("Invalid toolchain selection. Use --toolchains <id,id> or --toolchains all.");
  }
  if (ids.includes("all")) {
    if (ids.length !== 1) {
      throw new Error("The all toolchain selector cannot be combined with other IDs.");
    }
    return "all";
  }

  const knownIds = new Set(
    (toolchains as readonly ToolchainAdapter[]).map((toolchain) => getToolchainId(toolchain)),
  );
  const unknownIds = [...new Set(ids.filter((id) => !knownIds.has(id)))];
  if (unknownIds.length > 0) {
    throw new Error(
      `Unknown toolchain${unknownIds.length === 1 ? "" : "s"}: ${unknownIds.join(", ")}. Run --help to list valid IDs.`,
    );
  }

  return [...new Set(ids)];
}

function parsePackageManager(value: string | undefined): PackageManager | null {
  if (value == null) {
    return null;
  }
  if (packageManagers.some((packageManager) => packageManager === value)) {
    return value as PackageManager;
  }
  throw new Error(
    `Invalid package manager: ${value}. Expected one of: ${packageManagers.join(", ")}.`,
  );
}

function parseRouterMode(value: string | undefined): RouterMode | null {
  if (value == null) {
    return null;
  }
  if (value === "code" || value === "file") {
    return value;
  }
  throw new Error("Invalid router mode. Use --router code or --router file.");
}

function parseNonEmptyValue(value: string | undefined, label: string) {
  if (value == null) {
    return null;
  }
  if (value.length > 0) {
    return value;
  }
  throw new Error(`Invalid ${label}.`);
}
