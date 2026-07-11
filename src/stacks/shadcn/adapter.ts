import { defineToolchain } from "../../core/toolchain-adapter";

export const shadcn = defineToolchain({
  feature: "shadcn",
  label: "shadcn",
  catalog: "app",
  order: 17,
  package: "shadcn",
  command: "init",
  managedCli: {
    phase: "run",
    blocked: {
      cwd: "The initializer always runs in the selected target directory.",
    },
  },
  docs: [
    {
      url: "https://ui.shadcn.com/docs/cli",
      confidence: "high",
      review: {
        reason:
          "Adapter forwards the official shadcn initializer in the selected target and leaves component-library and preset choices to the user.",
        files: ["src/stacks/shadcn/adapter.ts", "src/stacks/shadcn/init.test.ts"],
        sections: ["init"],
        mustContain: ["shadcn init [options]"],
        checks: [
          "Confirm shadcn init still exposes its project choices through CLI arguments or prompts.",
          "Confirm --cwd still redirects initialization away from the selected target.",
        ],
      },
    },
  ],
  hint: "Run the shadcn project initializer",
  nonInteractive: {
    supported: false,
    reason: "component-library and preset choices depend on the target project",
  },
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
});
