import { ensureTypecheckScript, setScript } from "../core/package-json-utils";
import type { ToolchainAdapter } from "../core/toolchain-adapter";

export const knip: ToolchainAdapter = {
  feature: "knip",
  label: "Knip",
  hint: "Runs Knip through npx without installing it",
  updatePackageJson({ packageJson }) {
    ensureTypecheckScript(packageJson);
    setScript(packageJson, "knip", "npx knip");
  },
};
