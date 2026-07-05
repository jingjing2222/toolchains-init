import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { ensureTypecheckScript, setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

export const knip = defineToolchain({
  feature: "knip",
  label: "Knip",
  hint: "Runs Knip through npx without installing it",
  order: 60,
  package: "knip",
  command: "check",
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
