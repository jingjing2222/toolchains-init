import { defineToolchain } from "../../core/toolchain-adapter";

export const prisma = defineToolchain({
  feature: "prisma",
  label: "Prisma",
  catalog: "app",
  order: 16,
  package: "prisma",
  command: "init",
  managedCli: { phase: "run" },
  docs: [
    {
      url: "https://www.prisma.io/docs/cli/init",
      confidence: "high",
      review: {
        reason:
          "Adapter runs prisma init, tracks its generated files, and leaves database, client, and driver choices to the user.",
        files: ["src/stacks/prisma/adapter.ts", "src/stacks/prisma/init.test.ts"],
        sections: ["Usage"],
        mustContain: ["prisma init [options]"],
        checks: [
          "Confirm the default prisma init command still completes without stdin and creates Prisma configuration.",
          "Confirm prisma init still creates or updates .gitignore alongside its schema, config, and environment files.",
        ],
      },
    },
  ],
  hint: "Bootstrap Prisma schema and configuration",
  help: false,
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  targetFiles() {
    return ["prisma.config.ts", "prisma/schema.prisma", ".env", ".gitignore"];
  },
});
