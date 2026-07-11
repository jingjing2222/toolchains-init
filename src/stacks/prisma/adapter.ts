import { defineToolchain } from "../../core/toolchain-adapter";

export const prisma = defineToolchain({
  feature: "prisma",
  label: "Prisma",
  catalog: "app",
  order: 16,
  package: "prisma",
  command: "init",
  docs: [
    {
      url: "https://www.prisma.io/docs/cli/init",
      confidence: "high",
      review: {
        reason: "Adapter executes the documented prisma init command unchanged.",
        files: ["src/stacks/prisma/adapter.ts", "src/stacks/prisma/init.test.ts"],
        sections: ["Usage"],
        mustContain: ["prisma init [options]"],
        checks: ["Confirm prisma init remains the official initialization command."],
      },
    },
  ],
  hint: "Bootstrap Prisma schema and configuration",
  help: false,
  managedCli: true,
});
