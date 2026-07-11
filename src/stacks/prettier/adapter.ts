import { defineToolchain } from "../../core/toolchain-adapter";

export const prettier = defineToolchain({
  feature: "prettier",
  label: "Prettier",
  catalog: "quality",
  order: 31,
  package: "prettier",
  command: "check",
  docs: [
    {
      url: "https://prettier.io/docs/install",
      confidence: "high",
      review: {
        reason: "Adapter executes the documented prettier --check . command unchanged.",
        files: ["src/stacks/prettier/adapter.ts", "src/stacks/prettier/init.test.ts"],
        sections: ["Install"],
        mustContain: ["prettier --check ."],
        checks: ["Confirm prettier --check . remains the documented project check command."],
      },
    },
  ],
  hint: "Opinionated code formatter",
  subcommand: null,
  commandArgs: ["--check", "."],
  managedCli: true,
});
