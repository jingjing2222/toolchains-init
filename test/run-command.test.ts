import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CommandError,
  createCommandEnvironment,
  resolveCommandExit,
  runCommand,
} from "../src/core/run-command";

describe("run command environment", () => {
  it("strips only the parent Yarn PnP preload outside the PnP project", () => {
    const root = path.resolve("/repo");
    const userAgent = "yarn/4.17.0 npm/? node/v24.18.0 darwin arm64";
    const env = createCommandEnvironment("/tmp/app", {
      NODE_OPTIONS: `--require ${root}/.pnp.cjs --experimental-loader ${root}/.pnp.loader.mjs --trace-warnings`,
      npm_config_user_agent: userAgent,
    });

    expect(env.NODE_OPTIONS).toBe("--trace-warnings");
    expect(env.npm_config_user_agent).toBe(userAgent);
  });

  it("keeps Yarn PnP preload inside the PnP project", () => {
    const root = path.resolve("/repo");
    const nodeOptions = `--require ${root}/.pnp.cjs`;
    const env = createCommandEnvironment(`${root}/apps/web`, {
      NODE_OPTIONS: nodeOptions,
    });

    expect(env.NODE_OPTIONS).toBe(nodeOptions);
  });

  it("keeps package manager user agent inside the PnP project", () => {
    const root = path.resolve("/repo");
    const userAgent = "yarn/4.17.0 npm/? node/v24.18.0 darwin arm64";
    const env = createCommandEnvironment(`${root}/apps/web`, {
      NODE_OPTIONS: `--experimental-loader=${root}/.pnp.loader.mjs`,
      npm_config_user_agent: userAgent,
    });

    expect(env.npm_config_user_agent).toBe(userAgent);
  });

  it("removes NODE_OPTIONS when only the stale PnP preload exists", () => {
    const root = path.resolve("/repo");
    const env = createCommandEnvironment("/tmp/app", {
      NODE_OPTIONS: `--require=${root}/.pnp.cjs`,
    });

    expect(env.NODE_OPTIONS).toBeUndefined();
  });
});

describe("run command termination", () => {
  it("keeps a numeric child code in the wrapper exit action", () => {
    expect(resolveCommandExit(new CommandError("origin", [], 37))).toEqual({
      exitCode: 37,
      signal: null,
    });
  });

  it("preserves a child exit code without wrapper output", async () => {
    const result = runCommand(process.cwd(), process.execPath, ["-e", "process.exit(37)"]);

    await expect(result).rejects.toMatchObject({
      exitCode: 37,
      signal: null,
    } satisfies Partial<CommandError>);
  });

  it.skipIf(process.platform === "win32")("preserves a child termination signal", async () => {
    const result = runCommand(process.cwd(), process.execPath, [
      "-e",
      'process.kill(process.pid, "SIGTERM")',
    ]);

    await expect(result).rejects.toMatchObject({
      exitCode: null,
      signal: "SIGTERM",
    } satisfies Partial<CommandError>);
  });

  it("re-raises ordinary termination signals with a nonzero fallback", () => {
    expect(resolveCommandExit(new CommandError("origin", [], "SIGTERM"))).toEqual({
      exitCode: expectedSignalExitCode("SIGTERM"),
      signal: "SIGTERM",
    });
  });

  it.each(["SIGPIPE", "SIGUSR1"] as const)(
    "uses a silent conventional exit for Node-reserved %s",
    (signal) => {
      expect(resolveCommandExit(new CommandError("origin", [], signal))).toEqual({
        exitCode: expectedSignalExitCode(signal),
        signal: null,
      });
    },
  );
});

function expectedSignalExitCode(signal: NodeJS.Signals) {
  const signalNumber = os.constants.signals[signal];
  return signalNumber == null ? 1 : 128 + signalNumber;
}
