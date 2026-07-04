#!/usr/bin/env node

import { runInit } from "./commands/init";
import { packageVersion } from "./package-info";

async function main() {
  const [, , firstArg, ...restArgs] = process.argv;

  if (firstArg === "--version" || firstArg === "-v") {
    console.log(packageVersion);
    return;
  }

  if (firstArg === "--help" || firstArg === "-h") {
    printHelp();
    return;
  }

  await runInit(firstArg == null ? [] : [firstArg, ...restArgs]);
}

function printHelp() {
  console.log(`toolchains-init ${packageVersion}

Usage:
  toolchains-init [--target path] [--yes] [--no-install] [--router file|code]

Examples:
  yarn dlx toolchains-init
  npx toolchains-init
  pnpm dlx toolchains-init
  toolchains-init --target apps/web
  toolchains-init --yes --router code
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
