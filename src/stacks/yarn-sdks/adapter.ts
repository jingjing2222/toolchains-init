import { defineToolchain } from "../../core/toolchain-adapter";

export const yarnSdks = defineToolchain({
  id: "yarn-sdks",
  label: "Yarn SDKs (VS Code)",
  summary: "Generates Yarn PnP editor SDKs for VSCode",
  area: "editor",
  capabilities: ["editor-sdks"],
  order: 90,
  origin: {
    package: "@yarnpkg/sdks",
    command: "vscode",
    docs: [
      {
        url: "https://yarnpkg.com/cli/sdks/default",
        confidence: "high",
        review: {
          reason: "Adapter executes the documented yarn sdks vscode command unchanged.",
          files: ["src/stacks/yarn-sdks/adapter.ts", "src/stacks/yarn-sdks/init.test.ts"],
          sections: ["Examples"],
          mustContain: ["yarn sdks vscode"],
          checks: ["Confirm yarn sdks vscode remains the documented editor SDK command."],
        },
      },
    ],
    help: false,
    runner: {
      yarn: ["yarn", "dlx", "@yarnpkg/sdks@{version}", "vscode"],
    },
    subcommand: null,
  },
});
