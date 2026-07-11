import { defineToolchain } from "../../core/toolchain-adapter";

export const oxlint = defineToolchain({
  feature: "oxlint",
  label: "oxlint",
  hint: "Oxc linter",
  catalog: "quality",
  order: 40,
  package: "oxlint",
  command: "init",
  docs: [
    {
      url: "https://oxc.rs/docs/guide/usage/linter/config",
      confidence: "high",
      review: {
        reason: "Adapter executes the documented oxlint --init command unchanged.",
        files: ["src/stacks/oxlint/adapter.ts", "src/stacks/oxlint/init.test.ts"],
        sections: ["Oxlint", "Configuration"],
        mustContain: ["oxlint --init"],
        checks: ["Confirm oxlint --init remains the configuration initializer."],
      },
    },
  ],
  subcommand: null,
  commandArgs: ["--init"],
  managedCli: true,
});
