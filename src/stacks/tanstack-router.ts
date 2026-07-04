import { runCommand } from "../core/run-command";
import type { ToolchainAdapter } from "../core/toolchain-adapter";

export const tanStackRouter: ToolchainAdapter = {
  feature: "router",
  label: "TanStack Router",
  hint: "File-Based Routing or Code-Based Routing",
  async run({ cwd, packageManager, options, yes }) {
    const baseArgs = [
      "create",
      "--router-only",
      "--target-dir",
      ".",
      "--force",
      "--no-install",
      "--no-git",
      "--no-toolchain",
      "--no-examples",
      "--no-intent",
      "--package-manager",
      packageManager,
    ];
    const args =
      yes && options.routerMode === "file"
        ? [...baseArgs, "--framework", "React", "--yes"]
        : [...baseArgs, "--interactive"];

    const command =
      packageManager === "npm"
        ? { bin: "npx", args: ["@tanstack/cli", ...args] }
        : packageManager === "pnpm"
          ? { bin: "pnpm", args: ["dlx", "@tanstack/cli", ...args] }
          : { bin: "yarn", args: ["dlx", "@tanstack/cli", ...args] };

    await runCommand(cwd, command.bin, command.args);
  },
};
