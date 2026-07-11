import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

export const publint = defineToolchain({
  feature: "publint",
  label: "publint",
  catalog: "release",
  order: 81,
  package: "publint",
  command: "check",
  docs: [
    {
      url: "https://publint.dev/docs/",
      confidence: "high",
      review: {
        reason: "Adapter exposes the documented zero-config publint CLI through a package script.",
        files: ["src/stacks/publint/adapter.ts", "src/stacks/publint/init.test.ts"],
        sections: ["Usage"],
        mustContain: ["npx publint"],
        checks: [
          "Confirm publint remains runnable against the current package without local configuration.",
        ],
      },
    },
  ],
  hint: "Validate npm package publishing compatibility",
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  subcommand: null,
  updatePackageJson({ cliManifest, packageJson }) {
    if (cliManifest == null) {
      throw new Error("Missing publint CLI manifest");
    }
    setScript(
      packageJson,
      "lint:package",
      formatCliCommand(resolveCliCommand(cliManifest, "check", "npm")),
    );
  },
});
