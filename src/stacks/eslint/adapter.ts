import { defineToolchain } from "../../core/toolchain-adapter";

export const eslint = defineToolchain({
  feature: "eslint",
  label: "ESLint",
  catalog: "quality",
  order: 41,
  package: "@eslint/create-config",
  command: "init",
  docs: [
    {
      url: "https://eslint.org/docs/latest/use/getting-started",
      confidence: "high",
      review: {
        reason: "Adapter executes the official ESLint configuration CLI unchanged.",
        files: ["src/stacks/eslint/adapter.ts", "src/stacks/eslint/init.test.ts"],
        sections: ["Getting Started"],
        mustContain: ["npm init @eslint/config@latest"],
        checks: ["Confirm @eslint/create-config remains the official configuration CLI."],
      },
    },
  ],
  help: false,
  hint: "Find and fix problems in JavaScript code",
  runner: "dlx",
  subcommand: null,
  managedCli: true,
});
