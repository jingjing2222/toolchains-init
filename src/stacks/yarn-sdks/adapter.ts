import { defineToolchain } from "../../core/toolchain-adapter";

export const yarnSdks = defineToolchain({
  feature: "yarnSdks",
  label: "Yarn SDKs",
  hint: "Generates Yarn PnP editor SDKs for VSCode",
  catalog: "editor",
  order: 90,
  package: "@yarnpkg/sdks",
  command: "vscode",
  docs: [
    {
      url: "https://yarnpkg.com/cli/sdks",
      confidence: "high",
      review: {
        reason: "Adapter executes the documented yarn sdks vscode command unchanged.",
        files: ["src/stacks/yarn-sdks/adapter.ts", "src/stacks/yarn-sdks/init.test.ts"],
        sections: ["@yarnpkg/sdks CLI Reference"],
        mustContain: ["@yarnpkg/sdks", "yarn sdks"],
        checks: ["Confirm yarn sdks vscode remains the documented editor SDK command."],
      },
    },
  ],
  help: false,
  managedCli: true,
});
