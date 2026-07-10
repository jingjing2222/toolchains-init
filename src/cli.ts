#!/usr/bin/env node

import { runInit } from "./commands/init";
import { parseCliOptions, renderHelp } from "./core/cli-options";
import { packageVersion } from "./package-info";

async function main() {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.help) {
    console.log(renderHelp(packageVersion));
    return;
  }

  if (options.version) {
    console.log(packageVersion);
    return;
  }

  await runInit(options);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
