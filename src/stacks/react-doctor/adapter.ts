import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { ensureTypecheckScript, setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";

export const reactDoctor = defineToolchain({
  feature: "reactDoctor",
  label: "React Doctor",
  hint: "React health checks",
  catalog: "quality",
  order: 70,
  package: "react-doctor",
  command: "check",
  subcommand: null,
  updatePackageJson({ cliManifest, packageJson }) {
    if (cliManifest == null) {
      throw new Error("Missing React Doctor CLI manifest");
    }
    ensureTypecheckScript(packageJson);
    setScript(
      packageJson,
      "react-doctor",
      formatCliCommand(resolveCliCommand(cliManifest, "check", "npm")),
    );
  },
});
