import { defineToolchain } from "../../core/toolchain-adapter";

export const secretlint = defineToolchain({
  id: "secretlint",
  label: "Secretlint",
  summary: "Detect credentials and secrets in project files",
  area: "quality",
  capabilities: ["secret-scanning"],
  order: 90,
  origin: {
    package: "secretlint",
    command: "init",
    docs: [
      {
        url: "https://raw.githubusercontent.com/secretlint/secretlint/master/README.md",
        confidence: "high",
        review: {
          reason: "Adapter executes the documented secretlint --init command unchanged.",
          files: ["src/stacks/secretlint/adapter.ts", "src/stacks/secretlint/init.test.ts"],
          sections: ["Using Node.js"],
          mustContain: ["npx secretlint --init"],
          checks: ["Confirm secretlint --init remains the configuration initializer."],
        },
      },
    ],
    subcommand: null,
    commandArgs: ["--init"],
  },
});
