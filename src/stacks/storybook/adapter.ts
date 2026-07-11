import { defineToolchain } from "../../core/toolchain-adapter";

export const storybook = defineToolchain({
  feature: "storybook",
  label: "Storybook",
  catalog: "quality",
  order: 25,
  package: "create-storybook",
  command: "init",
  hint: "Frontend workshop for building UI components and pages in isolation",
  docs: [
    {
      url: "https://storybook.js.org/docs/get-started/install",
      confidence: "high",
      review: {
        reason: "Adapter executes the official Storybook initializer unchanged.",
        files: ["src/stacks/storybook/adapter.ts", "src/stacks/storybook/init.test.ts"],
        sections: ["Install Storybook"],
        mustContain: ["npm create storybook@latest"],
        checks: ["Confirm create-storybook remains the official initialization CLI."],
      },
    },
  ],
  runner: "create",
  subcommand: null,
  managedCli: true,
});
