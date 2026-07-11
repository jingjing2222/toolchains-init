import { setManifestDevDependency } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

export const changesets = defineToolchain({
  feature: "changesets",
  label: "Changesets",
  hint: "Versioning and changelog workflow",
  catalog: "release",
  order: 80,
  package: "@changesets/cli",
  command: "init",
  docs: [
    {
      url: "https://raw.githubusercontent.com/changesets/changesets/main/packages/cli/README.md",
      confidence: "medium",
      review: {
        reason: "Adapter installs Changesets and runs the documented init command after install.",
        files: ["src/stacks/changesets/adapter.ts", "src/stacks/changesets/init.test.ts"],
        sections: ["Getting Started"],
        mustContain: ["@changesets/cli", "changeset init"],
        checks: [
          "Confirm `@changesets/cli` remains the package that provides Changesets initialization.",
          "Confirm `changeset init` remains the documented setup command.",
        ],
      },
    },
  ],
  managedCli: {
    phase: "afterInstall",
  },
  updatePackageJson({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
  },
});
