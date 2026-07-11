import { spawn } from "node:child_process";
import path from "node:path";

export type RunCommandOptions = {
  stdin?: "ignore" | "inherit";
};

export function runCommand(
  cwd: string,
  command: string,
  args: readonly string[],
  options: RunCommandOptions = {},
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: createCommandEnvironment(cwd),
      stdio: options.stdin === "ignore" ? (["ignore", "inherit", "inherit"] as const) : "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      }
    });
    child.on("error", reject);
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
  delete nextEnv.npm_config_user_agent;
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
