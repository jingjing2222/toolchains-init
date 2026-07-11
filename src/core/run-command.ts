import { spawn } from "node:child_process";
import path from "node:path";

export class CommandError extends Error {
  readonly args: readonly string[];
  readonly command: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;

  constructor(command: string, args: readonly string[], result: number | NodeJS.Signals) {
    const exited = typeof result === "number";
    super(
      `${command} ${args.join(" ")} ${exited ? `failed with exit code ${result}` : `terminated by signal ${result}`}`,
    );
    this.name = "CommandError";
    this.args = [...args];
    this.command = command;
    this.exitCode = exited ? result : null;
    this.signal = exited ? null : result;
  }
}

export function runCommand(cwd: string, command: string, args: readonly string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: createCommandEnvironment(cwd),
      stdio: "inherit",
    });
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else if (code != null) {
        reject(new CommandError(command, args, code));
      } else {
        reject(
          signal == null
            ? new Error(`${command} ${args.join(" ")} terminated without an exit status`)
            : new CommandError(command, args, signal),
        );
      }
    });
    child.once("error", reject);
  });
}

export function createCommandEnvironment(cwd: string, baseEnv: NodeJS.ProcessEnv = process.env) {
  const nodeOptions = baseEnv.NODE_OPTIONS;
  if (nodeOptions == null || !nodeOptions.includes(".pnp.")) {
    return baseEnv;
  }

  const pnpPath = getPnpPreloadPath(nodeOptions);
  if (pnpPath == null || isInside(path.dirname(pnpPath), cwd)) {
    return baseEnv;
  }

  const nextEnv = { ...baseEnv };
  const nextNodeOptions = removePnpPreload(nodeOptions).trim();
  if (nextNodeOptions.length === 0) {
    delete nextEnv.NODE_OPTIONS;
  } else {
    nextEnv.NODE_OPTIONS = nextNodeOptions;
  }
  return nextEnv;
}

function getPnpPreloadPath(nodeOptions: string) {
  const tokens = nodeOptions.split(/\s+/).filter(Boolean);
  for (const [index, token] of tokens.entries()) {
    if (token === "--require" || token === "-r" || token === "--experimental-loader") {
      const value = tokens[index + 1];
      if (isPnpPreload(value)) {
        return path.resolve(value);
      }
    }

    const requirePrefix = "--require=";
    if (token.startsWith(requirePrefix) && isPnpPreload(token)) {
      return path.resolve(token.slice(requirePrefix.length));
    }

    const loaderPrefix = "--experimental-loader=";
    if (token.startsWith(loaderPrefix) && isPnpPreload(token)) {
      return path.resolve(token.slice(loaderPrefix.length));
    }
  }

  return null;
}

function removePnpPreload(nodeOptions: string) {
  const tokens = nodeOptions.split(/\s+/).filter(Boolean);
  const next: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--require" || token === "-r" || token === "--experimental-loader") {
      const value = tokens[index + 1];
      if (isPnpPreload(value)) {
        index += 1;
        continue;
      }
    }
    if (
      (token?.startsWith("--require=") || token?.startsWith("--experimental-loader=")) &&
      isPnpPreload(token)
    ) {
      continue;
    }
    next.push(token ?? "");
  }

  return next.join(" ");
}

function isPnpPreload(value: string | undefined): value is string {
  return value?.endsWith(".pnp.cjs") === true || value?.endsWith(".pnp.loader.mjs") === true;
}

function isInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
