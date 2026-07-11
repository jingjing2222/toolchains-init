import { defineToolchain } from "../../core/toolchain-adapter";

export const changesets = defineToolchain({
  feature: "changesets",
  label: "Changesets",
  hint: "Versioning and changelog workflow",
  catalog: "release",
  order: 80,
  package: "@changesets/cli",
  command: "init",
  docs: [
    {
      url: "https://raw.githubusercontent.com/changesets/changesets/main/packages/cli/README.md",
      confidence: "medium",
      review: {
        reason: "Adapter executes the documented changeset init command unchanged.",
        files: ["src/stacks/changesets/adapter.ts", "src/stacks/changesets/init.test.ts"],
        sections: ["Getting Started"],
        mustContain: ["@changesets/cli", "changeset init"],
        checks: ["Confirm changeset init remains the official initialization command."],
      },
    },
  ],
  managedCli: true,
});
