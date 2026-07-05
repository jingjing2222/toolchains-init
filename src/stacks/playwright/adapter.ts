import { runCommand } from "../../core/run-command";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { defineToolchain } from "../../core/toolchain-adapter";
import { playwrightCliManifest } from "./manifest";

export const playwright = defineToolchain({
  feature: "playwright",
  label: "Playwright",
  hint: "Runs the official Playwright initializer",
  package: "create-playwright",
  command: "init",
  docs: [{ url: "https://playwright.dev/docs/intro", confidence: "medium" }],
  async run({ cwd, packageManager, yes }) {
    const command = resolveCliCommand(
      playwrightCliManifest,
      "init",
      packageManager,
      yes ? { quiet: true, lang: "TypeScript", noBrowsers: true } : {},
    );

    await runCommand(cwd, command.bin, command.args);
  },
});
