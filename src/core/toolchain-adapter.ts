import type { CliCommandManifest } from "./cli-command-manifest";
import type { PackageManager } from "./package-manager";
import type { PackageJson, ToolchainOptions } from "./types";

export type RunToolchainContext = {
  cwd: string;
  packageManager: PackageManager;
  options: ToolchainOptions;
  yes: boolean;
};

export type ManagedCliFlagValue = boolean | string;

export type ManagedCliFlagValues = Readonly<Record<string, ManagedCliFlagValue>>;

type ToolchainSetupOption = Exclude<keyof ToolchainOptions, "features">;

export type ManagedCliSetupContract = {
  [Option in ToolchainSetupOption]: ToolchainOptions[Option] extends boolean
    ? {
        description: string;
        option: Option;
        type: "boolean";
      }
    : {
        description: string;
        option: Option;
        type: "enum";
        values: readonly ToolchainOptions[Option][];
      };
}[ToolchainSetupOption];

export type ToolchainOptionOverrides = Partial<Omit<ToolchainOptions, "features">>;

export type ManagedCliPolicyContext = {
  packageManager: PackageManager;
  options: ToolchainOptions;
  yes: boolean;
};

export type ManagedCliPolicyValue<T> = T | ((context: ManagedCliPolicyContext) => T);

export type ResolvedCliCommand = {
  bin: string;
  args: readonly string[];
};

export type ExecuteManagedCliContext = RunToolchainContext & {
  command: ResolvedCliCommand;
};

export type ManagedToolchainCli = {
  phase: "run" | "afterInstall";
  defaults?: ManagedCliPolicyValue<ManagedCliFlagValues>;
  locked?: ManagedCliPolicyValue<ManagedCliFlagValues>;
  blocked?: ManagedCliPolicyValue<Readonly<Record<string, string>>>;
  positionals?: ManagedCliPolicyValue<readonly string[]>;
  setup?: Readonly<Record<string, ManagedCliSetupContract>>;
  execute?: (context: ExecuteManagedCliContext) => Promise<void>;
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

const packageManagerNames = ["npm", "pnpm", "yarn", "bun", "deno"] as const;

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
  managedCli?: ManagedToolchainCli;
  nonInteractive?: {
    supported: false;
    reason: string;
  };
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
