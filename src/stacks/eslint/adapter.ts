import { defineToolchain } from "../../core/toolchain-adapter";

export const eslint = defineToolchain({
  id: "eslint",
  label: "ESLint",
  summary: "Find and fix problems in JavaScript code",
  area: "quality",
  capabilities: ["linting"],
  order: 41,
  origin: {
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
    runner: "dlx",
    subcommand: null,
  },
});
