import type { ExecutionPlan, ExecutionPlanStep } from "./execution-plan";
import { runCommand } from "./run-command";

export type ExecutionPlanHooks = {
  onStepStart?: (step: ExecutionPlanStep, index: number) => void;
  onStepComplete?: (step: ExecutionPlanStep, index: number) => void;
  onStepFailure?: (
    step: ExecutionPlanStep,
    index: number,
    remaining: number,
    error: unknown,
  ) => void;
};

export async function executePlan(plan: ExecutionPlan, hooks: ExecutionPlanHooks = {}) {
  for (const [index, step] of plan.steps.entries()) {
    hooks.onStepStart?.(step, index);
    try {
      await runCommand(plan.cwd, step.command.bin, step.command.args);
      hooks.onStepComplete?.(step, index);
    } catch (error) {
      hooks.onStepFailure?.(step, index, plan.steps.length - index - 1, error);
      throw error;
    }
  }
}
