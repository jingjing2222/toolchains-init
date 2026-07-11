import { defineToolchain } from "../../core/toolchain-adapter";

export const shadcn = defineToolchain({
  feature: "shadcn",
  label: "shadcn",
  catalog: "app",
  order: 17,
  package: "shadcn",
  command: "init",
  docs: [
    {
      url: "https://ui.shadcn.com/docs/cli",
      confidence: "high",
      review: {
        reason: "Adapter executes the official shadcn init command unchanged.",
        files: ["src/stacks/shadcn/adapter.ts", "src/stacks/shadcn/init.test.ts"],
        sections: ["init"],
        mustContain: ["shadcn init [options]"],
        checks: ["Confirm shadcn init remains the official initialization command."],
      },
    },
  ],
  hint: "Run the shadcn project initializer",
  managedCli: true,
});
