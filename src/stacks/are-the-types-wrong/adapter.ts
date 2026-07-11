import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

export const areTheTypesWrong = defineToolchain({
  feature: "areTheTypesWrong",
  label: "Are the Types Wrong?",
  catalog: "release",
  order: 82,
  package: "@arethetypeswrong/cli",
  command: "check",
  docs: [
    {
      url: "https://raw.githubusercontent.com/arethetypeswrong/arethetypeswrong.github.io/main/packages/cli/README.md",
      confidence: "high",
      review: {
        reason:
          "Adapter exposes the documented npm-only attw in-place package check through a package script.",
        files: [
          "src/stacks/are-the-types-wrong/adapter.ts",
          "src/stacks/are-the-types-wrong/init.test.ts",
        ],
        sections: ["Usage"],
        mustContain: ["attw --pack ."],
        checks: [
          "Confirm attw --pack . remains the supported in-place package analysis command.",
          "Confirm upstream still limits --pack to npm projects.",
        ],
      },
    },
  ],
  hint: "Check published TypeScript package compatibility",
  exportName: "attwCliManifest",
  stackDir: "are-the-types-wrong",
  packageManagers: ["npm"],
  subcommand: null,
  tool: "attw",
  updatePackageJson({ cliManifest, packageJson }) {
    if (cliManifest == null) {
      throw new Error("Missing Are the Types Wrong? CLI manifest");
    }
    const command = resolveCliCommand(cliManifest, "check", "npm", { pack: true });
    setScript(packageJson, "attw", formatCliCommand({ ...command, args: [...command.args, "."] }));
  },
});
