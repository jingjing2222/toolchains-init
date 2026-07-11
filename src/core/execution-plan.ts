import { resolveCliCommand, type CliCommandManifest } from "./cli-command-manifest";
import type { ToolchainCliUserArgs } from "./cli-surface";
import { createToolchainCliSurface } from "./cli-surface";
import type { PackageManager } from "./package-manager";
import {
  buildCatalogNotices,
  compareToolchainOrder,
  type CatalogNotice,
} from "./toolchain-catalog";
import type { ToolchainDefinition } from "./toolchain-adapter";
import { cliCommandManifests } from "../stacks/index";

export type ExecutionPlanStep = {
  id: string;
  label: string;
  packageName: string;
  packageVersion: string;
  command: {
    bin: string;
    args: readonly string[];
  };
  source: string;
};

export type ExecutionPlan = {
  cwd: string;
  packageManager: PackageManager;
  steps: readonly ExecutionPlanStep[];
  notices: readonly CatalogNotice[];
};

export function buildExecutionPlan({
  cwd,
  manifests = cliCommandManifests,
  packageManager,
  selectedToolchains,
  userArgs = {},
}: {
  cwd: string;
  manifests?: readonly CliCommandManifest[];
  packageManager: PackageManager;
  selectedToolchains: readonly ToolchainDefinition[];
  userArgs?: ToolchainCliUserArgs;
}): ExecutionPlan {
  const orderedToolchains = [...selectedToolchains].sort(compareToolchainOrder);
  const selectedIds = new Set(orderedToolchains.map((toolchain) => toolchain.id));
  validateSelectedInputKeys(selectedIds, userArgs);

  const surface = createToolchainCliSurface(orderedToolchains, manifests);
  const steps = surface.groups.map((group): ExecutionPlanStep => {
    const command = resolveCliCommand(
      group.manifest,
      group.command.id,
      packageManager,
      userArgs[group.toolchain.id] ?? [],
    );
    const docs = group.manifest.sources.find((source) => source.kind === "docs");
    if (docs == null) {
      throw new Error(`CLI adapter ${group.selector} has no documentation source.`);
    }

    return {
      id: group.toolchain.id,
      label: group.toolchain.label,
      packageName: group.manifest.package,
      packageVersion: group.manifest.version,
      command,
      source: docs.url,
    };
  });

  return {
    cwd,
    packageManager,
    steps,
    notices: buildCatalogNotices(orderedToolchains),
  };
}

export function renderExecutionPlan(plan: ExecutionPlan) {
  const lines = [
    `Target: ${plan.cwd}`,
    `Package manager: ${plan.packageManager}`,
    "",
    "Execution plan:",
  ];

  for (const [index, step] of plan.steps.entries()) {
    lines.push(
      "",
      `${index + 1}. ${step.label} [${step.id}]`,
      `   Package: ${step.packageName}@${step.packageVersion}`,
      `   Exec: ${step.command.bin}`,
      `   Args: ${JSON.stringify(step.command.args)}`,
      `   Source: ${step.source}`,
    );
  }

  if (plan.notices.length > 0) {
    lines.push("", "Warnings:");
    for (const notice of plan.notices) {
      lines.push(`- ${notice.message}`);
    }
  }

  lines.push(
    "",
    "Commands run sequentially and stop on the first failure.",
    "Completed or partial upstream changes are not rolled back.",
  );
  return lines.join("\n");
}

function validateSelectedInputKeys(
  selectedIds: ReadonlySet<string>,
  values: Readonly<Record<string, unknown>>,
) {
  for (const id of Object.keys(values)) {
    if (!selectedIds.has(id)) {
      throw new Error(`Origin CLI arguments were provided for an unselected toolchain: ${id}`);
    }
  }
}
