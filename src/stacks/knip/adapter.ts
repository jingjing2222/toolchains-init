import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { ensureTypecheckScript, setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

export const knip = defineToolchain({
  feature: "knip",
  label: "Knip",
  hint: "Runs Knip through npx without installing it",
  catalog: "quality",
  order: 60,
  package: "knip",
  command: "check",
  docs: [
    {
      url: "https://knip.dev/reference/cli",
      confidence: "high",
      review: {
        reason:
          "Adapter writes a package script that runs Knip through the manifest-backed npm command.",
        files: ["src/stacks/knip/adapter.ts", "src/stacks/knip/init.test.ts"],
        sections: ["CLI Arguments"],
        mustContain: ["knip", "--production"],
        checks: [
          "Confirm the default Knip CLI invocation remains suitable for project checks.",
          "Confirm script-based usage still does not require installing Knip as a project dependency.",
        ],
      },
    },
  ],
  subcommand: null,
  updatePackageJson({ cliManifest, packageJson }) {
    if (cliManifest == null) {
      throw new Error("Missing Knip CLI manifest");
    }
    ensureTypecheckScript(packageJson);
    setScript(
      packageJson,
      "knip",
      formatCliCommand(resolveCliCommand(cliManifest, "check", "npm")),
    );
  },
});
