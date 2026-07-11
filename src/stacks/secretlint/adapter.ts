import { defineToolchain } from "../../core/toolchain-adapter";

export const secretlint = defineToolchain({
  feature: "secretlint",
  label: "Secretlint",
  catalog: "quality",
  order: 90,
  package: "secretlint",
  command: "init",
  managedCli: {
    phase: "run",
    locked: { init: true },
  },
  docs: [
    {
      url: "https://raw.githubusercontent.com/secretlint/secretlint/master/README.md",
      confidence: "high",
      review: {
        reason:
          "Adapter runs the official Secretlint config initializer without selecting or installing rule presets.",
        files: ["src/stacks/secretlint/adapter.ts", "src/stacks/secretlint/init.test.ts"],
        sections: ["Using Node.js"],
        mustContain: ["npx secretlint --init"],
        checks: ["Confirm secretlint --init still creates .secretlintrc.json without stdin."],
      },
    },
  ],
  hint: "Detect credentials and secrets in project files",
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  subcommand: null,
  targetFiles() {
    return [".secretlintrc.json"];
  },
});
