import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { ensureTypecheckScript, setScript } from "../../core/package-json-utils";
import { defineToolchain } from "../../core/toolchain-adapter";
import { reactDoctorCliManifest } from "./manifest";

export const reactDoctor = defineToolchain({
  feature: "reactDoctor",
  label: "React Doctor",
  hint: "React health checks",
  package: "react-doctor",
  command: "check",
  subcommand: null,
  updatePackageJson({ packageJson }) {
    ensureTypecheckScript(packageJson);
    setScript(
      packageJson,
      "react-doctor",
      formatCliCommand(resolveCliCommand(reactDoctorCliManifest, "check", "npm")),
    );
  },
});
