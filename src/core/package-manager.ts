import { runCommand } from "./run-command";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export function detectPackageManager(env: NodeJS.ProcessEnv = process.env): PackageManager {
  return (
    getPackageManagerFromUserAgent(env.npm_config_user_agent) ??
    getPackageManagerFromExecPath(env.npm_execpath) ??
    "npm"
  );
}

export async function runInstall(packageManager: string, cwd: string) {
  await runCommand(cwd, packageManager, ["install"]);
}

function getPackageManagerFromUserAgent(userAgent?: string): PackageManager | null {
  const name = userAgent?.split(" ")[0]?.split("/")[0];
  return normalizePackageManager(name);
}

function getPackageManagerFromExecPath(execPath?: string): PackageManager | null {
  const normalized = execPath?.toLowerCase();
  if (normalized == null) {
    return null;
  }
  if (normalized.includes("pnpm")) {
    return "pnpm";
  }
  if (normalized.includes("yarn")) {
    return "yarn";
  }
  if (normalized.includes("bun")) {
    return "bun";
  }
  return "npm";
}

function normalizePackageManager(name?: string): PackageManager | null {
  if (name === "npm" || name === "pnpm" || name === "yarn" || name === "bun") {
    return name;
  }
  return null;
}
