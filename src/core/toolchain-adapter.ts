import type { CliCommandManifest } from "./cli-command-manifest";
import type { PackageManager } from "./package-manager";
import type { ToolchainOptions } from "./types";

export type ManagedCliFlagValue = boolean | string;

export type ManagedCliFlagValues = Readonly<Record<string, ManagedCliFlagValue>>;

export type ToolchainCatalog = "app" | "quality" | "release" | "editor";

export type PackageManagerCommandTemplates = Partial<Record<PackageManager, readonly string[]>>;

export type ToolchainCliRunner = "auto" | "create" | "dlx" | PackageManagerCommandTemplates;

const packageManagerNames = ["npm", "pnpm", "yarn", "bun", "deno"] as const;

export type ToolchainCliDocs = Omit<
  Extract<CliCommandManifest["sources"][number], { kind: "docs" }>,
  "checks" | "kind"
>;

export type ToolchainCliDefinition = {
  package: string;
  command: string;
  commandArgs?: readonly string[];
  commandId?: string;
  distTag?: string;
  docs?: readonly ToolchainCliDocs[];
  exportName?: string;
  help?: false;
  packageManagers?: readonly PackageManager[];
  runner?: ToolchainCliRunner;
  stackDir?: string;
  subcommand?: string | null;
  tool?: string;
};

export type ToolchainAdapter = {
  feature: ToolchainOptions["features"][number];
  label: string;
  hint: string;
  catalog: ToolchainCatalog;
  order?: number;
  cli?: ToolchainCliDefinition;
  managedCli?: true;
};

export type DefineToolchainOptions = Omit<ToolchainAdapter, "catalog" | "cli" | "hint"> & {
  catalog?: ToolchainCatalog;
  hint?: string;
} & (
    | {
        package: string;
        command: string;
        commandArgs?: readonly string[];
        commandId?: string;
        distTag?: string;
        docs?: ToolchainCliDefinition["docs"];
        exportName?: string;
        help?: false;
        packageManagers?: readonly PackageManager[];
        runner?: ToolchainCliRunner;
        stackDir?: string;
        subcommand?: string | null;
        tool?: string;
      }
    | {
        package?: never;
        command?: never;
      }
  );

export function defineToolchain(options: DefineToolchainOptions): ToolchainAdapter {
  const catalog = options.catalog ?? "quality";
  const hint = options.hint ?? "";
  if (options.package == null || options.command == null) {
    return { ...options, catalog, hint };
  }

  const {
    command,
    commandArgs,
    commandId,
    distTag,
    docs,
    exportName,
    help,
    package: packageName,
    packageManagers,
    runner,
    stackDir,
    subcommand,
    tool,
    ...adapter
  } = options;
  const resolvedPackageManagers =
    packageManagers ??
    (runner != null && typeof runner === "object"
      ? packageManagerNames.filter((packageManager) => runner[packageManager] != null)
      : undefined);

  return {
    ...adapter,
    catalog,
    hint,
    cli: {
      command,
      commandArgs,
      commandId,
      distTag,
      docs,
      exportName,
      help,
      package: packageName,
      packageManagers: resolvedPackageManagers,
      runner,
      stackDir,
      subcommand,
      tool,
    },
  };
}

export function getToolchainCliTool(toolchain: ToolchainAdapter) {
  return toolchain.cli?.tool ?? getToolchainId(toolchain);
}

export function getToolchainId(toolchain: Pick<ToolchainAdapter, "feature">) {
  return toolchain.feature.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
