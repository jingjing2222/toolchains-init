import { defineToolchain } from "../../core/toolchain-adapter";

export const prisma = defineToolchain({
  id: "prisma",
  label: "Prisma",
  summary: "Bootstrap Prisma schema and configuration",
  area: "app",
  capabilities: ["database-orm"],
  order: 16,
  origin: {
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
    help: false,
  },
});
