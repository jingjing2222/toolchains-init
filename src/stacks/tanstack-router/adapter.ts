import { defineToolchain } from "../../core/toolchain-adapter";

export const tanStackRouter = defineToolchain({
  feature: "router",
  label: "TanStack Router",
  hint: "File-Based Routing or Code-Based Routing",
  catalog: "app",
  order: 10,
  package: "@tanstack/cli",
  command: "create-router",
  subcommand: "create",
  commandArgs: ["--router-only"],
  tool: "tanstack-router",
  stackDir: "tanstack-router",
  exportName: "tanStackRouterCliManifest",
  docs: [
    {
      url: "https://raw.githubusercontent.com/TanStack/cli/main/README.md",
      confidence: "medium",
      review: {
        reason: "Adapter executes @tanstack/cli create --router-only unchanged.",
        files: ["src/stacks/tanstack-router/adapter.ts", "src/stacks/tanstack-router/init.test.ts"],
        sections: ["Quick Start"],
        mustContain: ["@tanstack/cli", "--router-only"],
        checks: ["Confirm @tanstack/cli create --router-only remains supported."],
      },
    },
  ],
  managedCli: true,
});
