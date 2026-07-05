import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { ensureTypecheckScript, setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";
import { knipCliManifest } from "./manifest";

export const knip = defineToolchain({
  feature: "knip",
  label: "Knip",
  hint: "Runs Knip through npx without installing it",
  package: "knip",
  command: "check",
  subcommand: null,
  updatePackageJson({ packageJson }) {
    ensureTypecheckScript(packageJson);
    setScript(
      packageJson,
      "knip",
      formatCliCommand(resolveCliCommand(knipCliManifest, "check", "npm")),
    );
  },
});
