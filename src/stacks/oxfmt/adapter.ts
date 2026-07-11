import { defineToolchain } from "../../core/toolchain-adapter";

export const oxfmt = defineToolchain({
  feature: "oxfmt",
  label: "oxfmt",
  hint: "Oxc formatter",
  catalog: "quality",
  order: 30,
  package: "oxfmt",
  command: "init",
  docs: [
    {
      url: "https://oxc.rs/docs/guide/usage/formatter/quickstart",
      confidence: "high",
      review: {
        reason: "Adapter executes the documented oxfmt --init command unchanged.",
        files: ["src/stacks/oxfmt/adapter.ts", "src/stacks/oxfmt/init.test.ts"],
        sections: ["Oxfmt", "Configuration"],
        mustContain: ["oxfmt --init"],
        checks: ["Confirm oxfmt --init remains the configuration initializer."],
      },
    },
  ],
  subcommand: null,
  commandArgs: ["--init"],
  managedCli: true,
});
