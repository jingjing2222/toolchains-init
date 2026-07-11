import { defineToolchain } from "../../core/toolchain-adapter";

export const secretlint = defineToolchain({
  feature: "secretlint",
  label: "Secretlint",
  catalog: "quality",
  order: 90,
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
  hint: "Detect credentials and secrets in project files",
  subcommand: null,
  commandArgs: ["--init"],
  managedCli: true,
});
