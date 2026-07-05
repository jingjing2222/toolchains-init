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
  docs: [
    {
      url: "https://raw.githubusercontent.com/millionco/react-doctor/main/packages/react-doctor/README.md",
      confidence: "medium",
      review: {
        reason:
          "Adapter writes a package script that runs React Doctor through the manifest-backed npm command.",
        files: ["src/stacks/react-doctor/adapter.ts", "src/stacks/react-doctor/init.test.ts"],
        sections: ["Quick start"],
        mustContain: ["react-doctor", "npx react-doctor@latest"],
        checks: [
          "Confirm React Doctor remains runnable through `npx react-doctor`.",
          "Confirm script-based usage still does not require installing React Doctor as a project dependency.",
        ],
      },
    },
  ],
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
