import { defineToolchain } from "../../core/toolchain-adapter";

export const playwright = defineToolchain({
  feature: "playwright",
  label: "Playwright",
  hint: "Runs the official Playwright initializer",
  catalog: "quality",
  order: 20,
  package: "create-playwright",
  command: "init",
  docs: [
    {
      url: "https://playwright.dev/docs/intro",
      confidence: "medium",
      review: {
        reason: "Adapter uses quiet TypeScript init flags when `--yes` is selected.",
        files: ["src/stacks/playwright/adapter.ts", "src/stacks/playwright/init.test.ts"],
        sections: ["Installing Playwright", "Init options"],
        mustContain: ["npm init playwright@latest", "TypeScript or JavaScript"],
        checks: [
          "Confirm `create-playwright` still supports quiet TypeScript setup without browser install.",
          "Confirm `--no-browsers`, `--quiet`, and `--lang TypeScript` still preserve intended behavior.",
        ],
      },
    },
  ],
  managedCli: {
    phase: "run",
    defaults({ yes }) {
      const defaults: Record<string, boolean | string> = {};
      if (yes) {
        defaults.lang = "TypeScript";
      }
      return defaults;
    },
    locked({ yes }) {
      const locked: Record<string, boolean | string> = {};
      if (yes) {
        locked.quiet = true;
        locked.noBrowsers = true;
      }
      return locked;
    },
    blocked: {
      installDeps: "Dependency installation is owned by toolchains-init.",
    },
  },
});
