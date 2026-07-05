import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const reactDoctorCliProbe = defineCliCommandProbe({
  exportName: "reactDoctorCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "react-doctor",
  package: "react-doctor",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "react-doctor@{version}", "--help"],
  commands: [
    {
      id: "check",
      packageManagers: {
        npm: ["npx", "react-doctor@{version}"],
        pnpm: ["pnpm", "dlx", "react-doctor@{version}"],
        yarn: ["yarn", "dlx", "react-doctor@{version}"],
      },
      interactive: true,
    },
  ],
});
