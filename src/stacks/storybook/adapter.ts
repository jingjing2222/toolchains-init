import { defineToolchain } from "../../core/toolchain-adapter";

export const storybook = defineToolchain({
  id: "storybook",
  label: "Storybook",
  summary: "Frontend workshop for building UI components and pages in isolation",
  area: "testing",
  capabilities: ["component-workshop"],
  order: 25,
  origin: {
    package: "create-storybook",
    command: "init",
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
  },
});
