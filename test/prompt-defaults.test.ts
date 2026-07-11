import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InitCliOptions } from "../src/core/cli-options";
import type { ExecutionPlan } from "../src/core/execution-plan";

const promptMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  confirm: vi.fn(),
  groupMultiselect: vi.fn(),
  intro: vi.fn(),
  isCancel: vi.fn(() => false),
  outro: vi.fn(),
}));
const executionMocks = vi.hoisted(() => ({
  executePlan: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  ...promptMocks,
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
  select: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("../src/core/execute-plan", () => executionMocks);

import { runInit } from "../src/commands/init";

const originalExitCode = process.exitCode;

describe("init orchestration", () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    promptMocks.groupMultiselect.mockResolvedValue(["oxlint"]);
    promptMocks.confirm.mockResolvedValue(true);
    executionMocks.executePlan.mockResolvedValue(undefined);
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleLog.mockRestore();
    process.exitCode = originalExitCode;
  });

  it("selects without defaults, renders a plan, confirms, and then runs interactively", async () => {
    await runInit(options(), { stdinIsTTY: true });

    expect(promptMocks.groupMultiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValues: [],
        options: expect.objectContaining({
          "App & Services": expect.arrayContaining([
            expect.objectContaining({ value: "hot-updater" }),
          ]),
          "Code Quality": expect.arrayContaining([expect.objectContaining({ value: "oxlint" })]),
          Release: expect.arrayContaining([expect.objectContaining({ value: "changesets" })]),
          "Testing & UI": expect.arrayContaining([
            expect.objectContaining({ value: "playwright" }),
          ]),
        }),
        selectableGroups: false,
      }),
    );
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Execution plan:"));
    expect(promptMocks.confirm).toHaveBeenCalledWith({
      initialValue: false,
      message: "Run these initializers?",
    });
    expect(consoleLog.mock.invocationCallOrder[0]).toBeLessThan(
      promptMocks.confirm.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(promptMocks.confirm.mock.invocationCallOrder[0]).toBeLessThan(
      executionMocks.executePlan.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(executionMocks.executePlan).toHaveBeenCalledOnce();
    const executedPlan = executionMocks.executePlan.mock.calls[0]?.[0] as ExecutionPlan;
    expect(executedPlan.steps.map((step) => step.id)).toEqual(["oxlint"]);
  });

  it("renders and runs a direct selection without a wrapper confirmation", async () => {
    await runInit(
      options({
        originArgs: { playwright: ["--browser=chromium"] },
        selectedToolIds: ["playwright"],
      }),
      { stdinIsTTY: false },
    );

    expect(promptMocks.groupMultiselect).not.toHaveBeenCalled();
    expect(promptMocks.confirm).not.toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Execution plan:"));
    expect(executionMocks.executePlan).toHaveBeenCalledOnce();
    const plan = executionMocks.executePlan.mock.calls[0]?.[0] as ExecutionPlan;
    expect(plan.steps.map((step) => step.id)).toEqual(["playwright"]);
    expect(plan.steps[0]?.command.args.at(-1)).toBe("--browser=chromium");
  });

  it("renders a plan-only selection without confirming or executing", async () => {
    await runInit(
      options({
        plan: true,
        selectedToolIds: ["biome", "oxfmt"],
      }),
      { stdinIsTTY: false },
    );

    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Execution plan:"));
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("Warnings:"));
    expect(promptMocks.confirm).not.toHaveBeenCalled();
    expect(executionMocks.executePlan).not.toHaveBeenCalled();
    expect(promptMocks.outro).toHaveBeenCalledWith("Plan complete. No commands were run.");
  });

  it("allows interactive plan-only selection without a confirmation", async () => {
    await runInit(options({ plan: true }), { stdinIsTTY: true });

    expect(promptMocks.groupMultiselect).toHaveBeenCalledOnce();
    expect(promptMocks.confirm).not.toHaveBeenCalled();
    expect(executionMocks.executePlan).not.toHaveBeenCalled();
  });

  it("rejects non-TTY runs without an explicit selector before planning", async () => {
    await runInit(options(), { stdinIsTTY: false });

    expect(promptMocks.cancel).toHaveBeenCalledWith(
      "Non-interactive runs require at least one explicit --<tool> selector.",
    );
    expect(promptMocks.groupMultiselect).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(executionMocks.executePlan).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});

function options(overrides: Partial<InitCliOptions> = {}): InitCliOptions {
  return {
    help: false,
    helpTool: null,
    originArgs: {},
    packageManager: "npm",
    plan: false,
    selectedToolIds: null,
    target: "/repo",
    version: false,
    ...overrides,
  };
}
