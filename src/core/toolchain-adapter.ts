import type { CliCommandManifest } from "./cli-command-manifest";
import type { ToolchainCapability } from "./toolchain-catalog";
import type { PackageManager } from "./package-manager";

export type ToolchainArea = "app" | "testing" | "quality" | "release" | "editor";

export type PackageManagerCommandTemplates = Partial<Record<PackageManager, readonly string[]>>;

export type ToolchainCliRunner = "auto" | "create" | "dlx" | PackageManagerCommandTemplates;

const packageManagerNames = ["npm", "pnpm", "yarn", "bun", "deno"] as const;

export type ToolchainOriginDocs = Omit<
  Extract<CliCommandManifest["sources"][number], { kind: "docs" }>,
  "checks" | "kind"
>;

export type ToolchainOriginDefinition = {
  package: string;
  command: string;
  commandArgs?: readonly string[];
  commandId?: string;
  distTag?: string;
  docs: readonly ToolchainOriginDocs[];
  help?: false;
  packageManagers?: readonly PackageManager[];
  runner?: ToolchainCliRunner;
  subcommand?: string | null;
};

export type ToolchainDefinition = {
  id: string;
  label: string;
  summary: string;
  area: ToolchainArea;
  capabilities: readonly ToolchainCapability[];
  order: number;
  origin: ToolchainOriginDefinition;
};

export type DefineToolchainOptions = Omit<ToolchainDefinition, "origin"> & {
  origin: Omit<ToolchainOriginDefinition, "packageManagers">;
};

export function defineToolchain(options: DefineToolchainOptions): ToolchainDefinition {
  const { origin, ...toolchain } = options;
  const { runner } = origin;
  const packageManagers =
    runner != null && typeof runner === "object"
      ? packageManagerNames.filter((packageManager) => runner[packageManager] != null)
      : undefined;

  return {
    ...toolchain,
    origin: {
      ...origin,
      packageManagers,
    },
  };
}
