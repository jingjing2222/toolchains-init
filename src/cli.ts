#!/usr/bin/env node

import { runInit } from "./commands/init";
import { parseCliOptions, renderHelp } from "./core/cli-options";
import { CommandError } from "./core/run-command";
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
    if (error.signal != null) {
      process.kill(process.pid, error.signal);
    } else {
      process.exitCode = error.exitCode ?? 1;
    }
    return;
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
