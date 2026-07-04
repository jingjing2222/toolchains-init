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

export type ToolchainAdapter = {
  feature: ToolchainOptions["features"][number];
  label: string;
  hint: string;
  isAvailable?: (context: ToolchainAvailabilityContext) => boolean | Promise<boolean>;
  run?: (context: RunToolchainContext) => Promise<void>;
  updatePackageJson?: (context: UpdatePackageJsonContext) => void;
  targetFiles?: (options: ToolchainOptions) => readonly string[];
  afterWrite?: (context: WriteToolchainContext) => Promise<void>;
  afterInstall?: (context: RunToolchainContext) => Promise<void>;
  notes?: (context: ToolchainNoteContext) => string[];
};
