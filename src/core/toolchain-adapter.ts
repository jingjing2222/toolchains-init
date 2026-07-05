import type { PackageManager } from "./package-manager";
import type { PackageJson, ToolchainOptions } from "./types";

export type RunToolchainContext = {
  cwd: string;
  packageManager: PackageManager;
  options: ToolchainOptions;
  yes: boolean;
};

export type UpdatePackageJsonContext = {
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
  packageManager: PackageManager;
};

export type PackageManagerCommandTemplates = Partial<Record<PackageManager, readonly string[]>>;

export type ToolchainCliRunner = "auto" | "create" | "dlx" | PackageManagerCommandTemplates;

export type ToolchainCliDefinition = {
  package: string;
  command: string;
  commandId?: string;
  distTag?: string;
  docs?: readonly { url: string; confidence: "low" | "medium" | "high" }[];
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
  cli?: ToolchainCliDefinition;
  isAvailable?: (context: ToolchainAvailabilityContext) => boolean | Promise<boolean>;
  run?: (context: RunToolchainContext) => Promise<void>;
  updatePackageJson?: (context: UpdatePackageJsonContext) => void;
  targetFiles?: (options: ToolchainOptions) => readonly string[];
  afterWrite?: (context: WriteToolchainContext) => Promise<void>;
  afterInstall?: (context: RunToolchainContext) => Promise<void>;
  notes?: (context: ToolchainNoteContext) => string[];
};

export type DefineToolchainOptions = Omit<ToolchainAdapter, "cli" | "hint"> & { hint?: string } & (
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
  const hint = options.hint ?? "";
  if (options.package == null || options.command == null) {
    return { ...options, hint };
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
