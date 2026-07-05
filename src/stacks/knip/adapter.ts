import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { ensureTypecheckScript, setScript } from "../../core/package-json-utils";
import type { ToolchainAdapter } from "../../core/toolchain-adapter";
import { knipCliManifest } from "./manifest";

export const knip: ToolchainAdapter = {
  feature: "knip",
  label: "Knip",
  hint: "Runs Knip through npx without installing it",
  updatePackageJson({ packageJson }) {
    ensureTypecheckScript(packageJson);
    setScript(
      packageJson,
      "knip",
      formatCliCommand(resolveCliCommand(knipCliManifest, "check", "npm")),
    );
  },
};
