import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionPlan } from "../src/core/execution-plan";

const commandMocks = vi.hoisted(() => ({
  runCommand: vi.fn(),
}));

vi.mock("../src/core/run-command", async () => {
  const actual =
    await vi.importActual<typeof import("../src/core/run-command")>("../src/core/run-command");
  return {
    ...actual,
    runCommand: commandMocks.runCommand,
  };
});

import { executePlan } from "../src/core/execute-plan";
import { CommandError } from "../src/core/run-command";

describe("executePlan", () => {
  beforeEach(() => {
    commandMocks.runCommand.mockReset();
  });

  it("runs the structured commands sequentially with the plan working directory", async () => {
    let releaseFirst: (() => void) | undefined;
    commandMocks.runCommand
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);
    const execution = executePlan(plan());

    await vi.waitFor(() => expect(commandMocks.runCommand).toHaveBeenCalledTimes(1));
    expect(commandMocks.runCommand).toHaveBeenNthCalledWith(1, "/repo", "first", ["init"]);
    expect(commandMocks.runCommand).not.toHaveBeenCalledWith("/repo", "second", ["init"]);

    releaseFirst?.();
    await execution;

    expect(commandMocks.runCommand).toHaveBeenNthCalledWith(2, "/repo", "second", ["init"]);
    expect(commandMocks.runCommand).toHaveBeenNthCalledWith(3, "/repo", "third", ["init"]);
  });

  it("stops on the first failure, reports remaining steps, and rethrows the same error", async () => {
    const error = new CommandError("second", ["init"], 37);
    commandMocks.runCommand.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
    const onStepStart = vi.fn();
    const onStepComplete = vi.fn();
    const onStepFailure = vi.fn();

    await expect(executePlan(plan(), { onStepComplete, onStepFailure, onStepStart })).rejects.toBe(
      error,
    );

    expect(commandMocks.runCommand).toHaveBeenCalledTimes(2);
    expect(commandMocks.runCommand).toHaveBeenNthCalledWith(1, "/repo", "first", ["init"]);
    expect(commandMocks.runCommand).toHaveBeenNthCalledWith(2, "/repo", "second", ["init"]);
    expect(commandMocks.runCommand).not.toHaveBeenCalledWith("/repo", "third", ["init"]);
    expect(onStepComplete).toHaveBeenCalledOnce();
    expect(onStepFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: "second" }),
      1,
      1,
      error,
    );
  });

  it("does not roll back completed or partial origin-side state after a failure", async () => {
    const originState: string[] = [];
    commandMocks.runCommand.mockImplementation(
      async (_cwd: string, command: string, _args: readonly string[]) => {
        originState.push(command);
        if (command === "second") {
          originState.push("second:partial-change");
          throw new CommandError(command, ["init"], 1);
        }
      },
    );

    await expect(executePlan(plan())).rejects.toBeInstanceOf(CommandError);

    expect(originState).toEqual(["first", "second", "second:partial-change"]);
  });
});

function plan(): ExecutionPlan {
  return {
    cwd: "/repo",
    notices: [],
    packageManager: "npm",
    steps: ["first", "second", "third"].map((id) => ({
      command: { args: ["init"], bin: id },
      id,
      label: id,
      packageName: `create-${id}`,
      packageVersion: "1.0.0",
      source: `https://example.com/${id}`,
    })),
  };
}
