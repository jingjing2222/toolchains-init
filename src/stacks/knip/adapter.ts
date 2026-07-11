import { defineToolchain } from "../../core/toolchain-adapter";

export const knip = defineToolchain({
  feature: "knip",
  label: "Knip",
  hint: "Run Knip project checks",
  catalog: "quality",
  order: 60,
  package: "knip",
  command: "check",
  docs: [
    {
      url: "https://knip.dev/reference/cli",
      confidence: "high",
      review: {
        reason: "Adapter executes the bare Knip CLI unchanged.",
        files: ["src/stacks/knip/adapter.ts", "src/stacks/knip/init.test.ts"],
        sections: ["CLI Arguments"],
        mustContain: ["knip"],
        checks: ["Confirm the bare knip command remains the general project check."],
      },
    },
  ],
  subcommand: null,
  managedCli: true,
});
