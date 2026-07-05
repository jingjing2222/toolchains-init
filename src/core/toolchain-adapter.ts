import type { CliCommandManifest } from "./cli-command-manifest";
import type { PackageManager } from "./package-manager";
import type { PackageJson, ToolchainOptions } from "./types";

export type RunToolchainContext = {
  cwd: string;
  packageManager: PackageManager;
  options: ToolchainOptions;
  yes: boolean;
};

export type UpdatePackageJsonContext = {
  cliManifest?: CliCommandManifest;
  packageJson: PackageJson;
  options: ToolchainOptions;
};

export type WriteToolchainContext = {
  cwd: string;
  options: ToolchainOptions;
};

export type ToolchainNoteContext = {
  options: ToolchainOptions;
};

export type ToolchainAvailabilityContext = {
  cwd: string;
  packageJson: PackageJson;
  packageManager: PackageManager;
};

export type ToolchainCatalog = "app" | "quality" | "release" | "editor";

export type PackageManagerCommandTemplates = Partial<Record<PackageManager, readonly string[]>>;

export type ToolchainCliRunner = "auto" | "create" | "dlx" | PackageManagerCommandTemplates;

export type ToolchainCliDocs = Omit<
  Extract<CliCommandManifest["sources"][number], { kind: "docs" }>,
  "checks" | "kind"
>;

export type ToolchainCliDefinition = {
  package: string;
  command: string;
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
  isAvailable?: (context: ToolchainAvailabilityContext) => boolean | Promise<boolean>;
  beforeRun?: (context: UpdatePackageJsonContext) => void;
  run?: (context: RunToolchainContext) => Promise<void>;
  updatePackageJson?: (context: UpdatePackageJsonContext) => void;
  targetFiles?: (options: ToolchainOptions) => readonly string[];
  afterWrite?: (context: WriteToolchainContext) => Promise<void>;
  afterInstall?: (context: RunToolchainContext) => Promise<void>;
  notes?: (context: ToolchainNoteContext) => string[];
};

export type DefineToolchainOptions = Omit<ToolchainAdapter, "catalog" | "cli" | "hint"> & {
  catalog?: ToolchainCatalog;
  hint?: string;
} & (
    | {
        package: string;
        command: string;
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

  return {
    ...adapter,
    catalog,
    hint,
    cli: {
      command,
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
    },
  };
}

export function getToolchainCliTool(toolchain: ToolchainAdapter) {
  return toolchain.cli?.tool ?? kebabCase(toolchain.feature);
}

function kebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
