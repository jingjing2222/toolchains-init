import { defineToolchain } from "../../core/toolchain-adapter";

export const publint = defineToolchain({
  feature: "publint",
  label: "publint",
  catalog: "release",
  order: 81,
  package: "publint",
  command: "check",
  docs: [
    {
      url: "https://publint.dev/docs/",
      confidence: "high",
      review: {
        reason: "Adapter executes the bare publint CLI unchanged.",
        files: ["src/stacks/publint/adapter.ts", "src/stacks/publint/init.test.ts"],
        sections: ["Usage"],
        mustContain: ["npx publint"],
        checks: ["Confirm the bare publint command remains the general package check."],
      },
    },
  ],
  hint: "Validate npm package publishing compatibility",
  subcommand: null,
  managedCli: true,
});
