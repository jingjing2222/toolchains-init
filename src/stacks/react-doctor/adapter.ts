import { formatCliCommand, resolveCliCommand } from "../../core/cli-command-manifest";
import { ensureTypecheckScript, setScript } from "../../core/package-json-utils";
import type { ToolchainAdapter } from "../../core/toolchain-adapter";
import { reactDoctorCliManifest } from "./manifest";

export const reactDoctor: ToolchainAdapter = {
  feature: "reactDoctor",
  label: "React Doctor",
  hint: "React health checks",
  updatePackageJson({ packageJson }) {
    ensureTypecheckScript(packageJson);
    setScript(
      packageJson,
      "react-doctor",
      formatCliCommand(resolveCliCommand(reactDoctorCliManifest, "check", "npm")),
    );
  },
};
