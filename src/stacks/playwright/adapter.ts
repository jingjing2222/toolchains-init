import { runCommand } from "../../core/run-command";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { defineToolchain } from "../../core/toolchain-adapter";

export const playwright = defineToolchain({
  feature: "playwright",
  label: "Playwright",
  hint: "Runs the official Playwright initializer",
  catalog: "quality",
  order: 20,
  package: "create-playwright",
  command: "init",
  docs: [{ url: "https://playwright.dev/docs/intro", confidence: "medium" }],
  async run({ cwd, packageManager, yes }) {
    const { playwrightCliManifest } = await import("./manifest");
    const command = resolveCliCommand(
      playwrightCliManifest,
      "init",
      packageManager,
      yes ? { quiet: true, lang: "TypeScript", noBrowsers: true } : {},
    );

    await runCommand(cwd, command.bin, command.args);
  },
});
