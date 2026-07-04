import { ensureTypecheckScript, setScript } from "../core/package-json-utils";
import type { ToolchainAdapter } from "../core/toolchain-adapter";

export const reactDoctor: ToolchainAdapter = {
  feature: "reactDoctor",
  label: "React Doctor",
  hint: "React health checks",
  updatePackageJson({ packageJson }) {
    ensureTypecheckScript(packageJson);
    setScript(packageJson, "react-doctor", "npx react-doctor@latest");
  },
};
