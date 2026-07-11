import { cancel, groupMultiselect, intro, isCancel, outro } from "@clack/prompts";
import type { Option } from "@clack/prompts";
import path from "node:path";
import pc from "picocolors";
import type { InitCliOptions } from "../core/cli-options";
import { runExternalToolchains } from "../core/external-toolchains";
import { resolveManagedCliPlans } from "../core/managed-cli";
import { detectPackageManager } from "../core/package-manager";
import type { ToolchainAdapter, ToolchainCatalog } from "../core/toolchain-adapter";
import { getToolchainCliTool } from "../core/toolchain-adapter";
import type { Feature } from "../core/types";
import { getSelectedToolchains, toolchains } from "../stacks/index";

const toolchainCatalogs = [
  ["app", "App Foundation"],
  ["quality", "Quality & Testing"],
  ["release", "Release"],
  ["editor", "Editor"],
] as const satisfies readonly (readonly [ToolchainCatalog, string])[];

export async function runInit(cliOptions: InitCliOptions) {
  const { managedCliArgs, selectedFeatures, yes } = cliOptions;
  const cwd = path.resolve(process.cwd(), cliOptions.target ?? ".");
  const packageManager = cliOptions.packageManager ?? detectPackageManager();

  intro(pc.bgBlue(pc.white(" toolchains-init ")));

  const availableToolchains = (toolchains as readonly ToolchainAdapter[]).filter(
    (toolchain) => toolchain.cli?.packageManagers?.includes(packageManager) ?? true,
  );
  let features: Feature[] | null;
  if (selectedFeatures != null) {
    const requestedAdapters = getSelectedToolchains(selectedFeatures);
    const availableFeatureSet = new Set(availableToolchains.map((toolchain) => toolchain.feature));
    const unavailable = requestedAdapters.filter(
      (toolchain) => !availableFeatureSet.has(toolchain.feature),
    );
    if (unavailable.length > 0) {
      cancel(
        `Toolchain${unavailable.length === 1 ? " is" : "s are"} not supported by ${packageManager}: ${unavailable
          .map((toolchain) => getToolchainCliTool(toolchain))
          .join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }
    features = requestedAdapters.map((toolchain) => toolchain.feature);
  } else {
    if (yes) {
      cancel("The --yes option requires at least one direct --<tool> selector.");
      process.exitCode = 1;
      return;
    }
    features = await selectFeatures(availableToolchains);
  }
  if (features == null) {
    cancel("Initialization cancelled.");
    return;
  }

  const selectedToolchains = getSelectedToolchains(features);
  const options = { features };
  const managedCliPlans = resolveManagedCliPlans({
    packageManager,
    selectedToolchains,
    userArgs: managedCliArgs,
  });

  outro(
    `Wrapper selection complete. Passing control to ${selectedToolchains.length} upstream CLI command${selectedToolchains.length === 1 ? "" : "s"}.`,
  );
  await runExternalToolchains(cwd, packageManager, options, managedCliPlans);
}

export async function selectFeatures(
  availableToolchains: readonly ToolchainAdapter[],
): Promise<Feature[] | null> {
  const selected = await groupMultiselect({
    message: "Which upstream CLI commands should run?",
    options: groupToolchainOptions(availableToolchains),
    required: true,
    initialValues: [],
    selectableGroups: true,
  });

  return isCancel(selected) ? null : (selected as Feature[]);
}

function groupToolchainOptions(availableToolchains: readonly ToolchainAdapter[]) {
  const entries: Array<[string, Option<Feature>[]]> = [];

  for (const [catalog, label] of toolchainCatalogs) {
    const options = availableToolchains
      .filter((toolchain) => toolchain.catalog === catalog)
      .map(
        (toolchain): Option<Feature> => ({
          value: toolchain.feature,
          label: toolchain.label,
          hint: toolchain.hint,
        }),
      );

    if (options.length > 0) {
      entries.push([label, options]);
    }
  }

  return Object.fromEntries(entries);
}
