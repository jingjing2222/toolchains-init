#!/usr/bin/env node

import { runInit } from "./commands/init";
import { parseCliOptions, renderHelp } from "./core/cli-options";
import { CommandError, resolveCommandExit } from "./core/run-command";
import { packageVersion } from "./package-info";

async function main() {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.help) {
    console.log(renderHelp(packageVersion, options.helpTool));
    return;
  }

  if (options.version) {
    console.log(packageVersion);
    return;
  }

  await runInit(options);
}

main().catch((error: unknown) => {
  if (error instanceof CommandError) {
    const exit = resolveCommandExit(error);
    process.exitCode = exit.exitCode;
    if (exit.signal != null) {
      try {
        process.kill(process.pid, exit.signal);
      } catch {
        // Keep the conventional nonzero signal exit code as a cross-platform fallback.
      }
    }
    return;
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
