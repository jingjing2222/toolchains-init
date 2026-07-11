import { defineToolchain } from "../../core/toolchain-adapter";

export const msw = defineToolchain({
  feature: "msw",
  label: "MSW",
  catalog: "quality",
  order: 26,
  package: "msw",
  command: "init",
  hint: "Seamless REST/GraphQL API mocking library for browser and Node.js",
  docs: [
    {
      url: "https://mswjs.io/docs/cli/init/",
      confidence: "high",
      review: {
        reason: "Adapter executes the bare msw init command unchanged.",
        files: ["src/stacks/msw/adapter.ts", "src/stacks/msw/init.test.ts"],
        sections: ["init", "Usage"],
        mustContain: ["npx msw init"],
        checks: ["Confirm msw init remains the official worker initialization command."],
      },
    },
  ],
  managedCli: true,
});
