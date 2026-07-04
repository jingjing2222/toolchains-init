import { runCommand } from "../core/run-command";
import type { ToolchainAdapter } from "../core/toolchain-adapter";

export const playwright: ToolchainAdapter = {
  feature: "playwright",
  label: "Playwright",
  hint: "Runs the official Playwright initializer",
  async run({ cwd, packageManager, yes }) {
    const baseArgs = yes ? ["--quiet", "--lang", "TypeScript", "--no-browsers"] : [];
    const command =
      packageManager === "npm"
        ? { bin: "npm", args: ["init", "playwright@latest", "--", ...baseArgs] }
        : packageManager === "pnpm"
          ? { bin: "pnpm", args: ["create", "playwright", ...baseArgs] }
          : { bin: "yarn", args: ["create", "playwright", ...baseArgs] };

    await runCommand(cwd, command.bin, command.args);
  },
};
