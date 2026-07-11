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
        reason: "Adapter executes the official Playwright initializer unchanged.",
        files: ["src/stacks/playwright/adapter.ts", "src/stacks/playwright/init.test.ts"],
        sections: ["Installing Playwright", "Init options"],
        mustContain: ["npm init playwright@latest"],
        checks: ["Confirm create-playwright remains the official initialization CLI."],
      },
    },
  ],
  managedCli: true,
});
