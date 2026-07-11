import { defineToolchain } from "../../core/toolchain-adapter";

export const areTheTypesWrong = defineToolchain({
  feature: "areTheTypesWrong",
  label: "Are the Types Wrong?",
  catalog: "release",
  order: 82,
  package: "@arethetypeswrong/cli",
  command: "check",
  docs: [
    {
      url: "https://raw.githubusercontent.com/arethetypeswrong/arethetypeswrong.github.io/main/packages/cli/README.md",
      confidence: "high",
      review: {
        reason: "Adapter executes the general attw CLI unchanged.",
        files: [
          "src/stacks/are-the-types-wrong/adapter.ts",
          "src/stacks/are-the-types-wrong/init.test.ts",
        ],
        sections: ["Usage"],
        mustContain: ["attw"],
        checks: ["Confirm the bare attw command remains the general CLI entry point."],
      },
    },
  ],
  hint: "Check published TypeScript package compatibility",
  exportName: "attwCliManifest",
  stackDir: "are-the-types-wrong",
  subcommand: null,
  tool: "attw",
  managedCli: true,
});
