import { cancel, confirm, groupMultiselect, intro, isCancel, outro } from "@clack/prompts";
import type { Option } from "@clack/prompts";
import path from "node:path";
import pc from "picocolors";
import type { InitCliOptions } from "../core/cli-options";
import { executePlan } from "../core/execute-plan";
import { buildExecutionPlan, renderExecutionPlan } from "../core/execution-plan";
import { detectPackageManager } from "../core/package-manager";
import { toolchainAreaLabels } from "../core/toolchain-catalog";
import type { ToolchainArea, ToolchainDefinition } from "../core/toolchain-adapter";
import { getSelectedToolchains, toolchains } from "../stacks/index";

const areaOrder = [
  "app",
  "testing",
  "quality",
  "release",
  "editor",
] as const satisfies readonly ToolchainArea[];

export async function runInit(cliOptions: InitCliOptions, runtime: { stdinIsTTY?: boolean } = {}) {
  const cwd = path.resolve(process.cwd(), cliOptions.target ?? ".");
  const packageManager = cliOptions.packageManager ?? detectPackageManager();
  const stdinIsTTY = runtime.stdinIsTTY ?? process.stdin.isTTY === true;

  intro(pc.bgBlue(pc.white(" toolchains-init ")));

  const availableToolchains = toolchains.filter(
    (toolchain) => toolchain.origin.packageManagers?.includes(packageManager) ?? true,
  );
  const interactiveSelection = cliOptions.selectedToolIds == null;
  let selectedIds: readonly string[] | null;

  if (cliOptions.selectedToolIds != null) {
    const requested = getSelectedToolchains(cliOptions.selectedToolIds);
    const availableIds = new Set(availableToolchains.map((toolchain) => toolchain.id));
    const unavailable = requested.filter((toolchain) => !availableIds.has(toolchain.id));
    if (unavailable.length > 0) {
      cancel(
        `Initializer${unavailable.length === 1 ? " is" : "s are"} not supported by ${packageManager}: ${unavailable
          .map((toolchain) => toolchain.id)
          .join(", ")}`,
      );
      process.exitCode = 1;
      return;
    }
    selectedIds = requested.map((toolchain) => toolchain.id);
  } else {
    if (!stdinIsTTY) {
      cancel("Non-interactive runs require at least one explicit --<tool> selector.");
      process.exitCode = 1;
      return;
    }
    selectedIds = await selectToolIds(availableToolchains);
  }

  if (selectedIds == null) {
    cancel("Initialization cancelled.");
    return;
  }

  const selectedToolchains = getSelectedToolchains(selectedIds);
  const plan = buildExecutionPlan({
    cwd,
    packageManager,
    selectedToolchains,
    userArgs: cliOptions.originArgs,
  });

  console.log(renderExecutionPlan(plan));

  if (cliOptions.plan) {
    outro("Plan complete. No commands were run.");
    return;
  }

  if (interactiveSelection) {
    const accepted = await confirm({
      message: "Run these initializers?",
      initialValue: false,
    });
    if (isCancel(accepted) || !accepted) {
      cancel("Initialization cancelled.");
      return;
    }
  }

  outro(`Starting ${plan.steps.length} upstream initializer${plan.steps.length === 1 ? "" : "s"}.`);
  await executePlan(plan, {
    onStepStart(step, index) {
      console.log(`[${index + 1}/${plan.steps.length}] Running ${step.label}`);
    },
    onStepComplete(step, index) {
      console.log(`[${index + 1}/${plan.steps.length}] Completed ${step.label}`);
    },
    onStepFailure(step, index, remaining) {
      console.error(
        `[${index + 1}/${plan.steps.length}] ${step.label} failed; ${remaining} initializer${remaining === 1 ? "" : "s"} not run.`,
      );
    },
  });
}

export async function selectToolIds(
  availableToolchains: readonly ToolchainDefinition[],
): Promise<readonly string[] | null> {
  const selected = await groupMultiselect({
    message: "Which upstream initializers should run?",
    options: groupToolchainOptions(availableToolchains),
    required: true,
    initialValues: [],
    selectableGroups: false,
  });

  return isCancel(selected) ? null : (selected as string[]);
}

function groupToolchainOptions(availableToolchains: readonly ToolchainDefinition[]) {
  const entries: Array<[string, Option<string>[]]> = [];

  for (const area of areaOrder) {
    const options = availableToolchains
      .filter((toolchain) => toolchain.area === area)
      .map(
        (toolchain): Option<string> => ({
          value: toolchain.id,
          label: toolchain.label,
          hint: toolchain.summary,
        }),
      );

    if (options.length > 0) {
      entries.push([toolchainAreaLabels[area], options]);
    }
  }

  return Object.fromEntries(entries);
}
