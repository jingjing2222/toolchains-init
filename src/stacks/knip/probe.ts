import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const knipCliProbe = defineCliCommandProbe({
  exportName: "knipCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "knip",
  package: "knip",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "knip@{version}", "--help"],
  commands: [
    {
      id: "check",
      packageManagers: {
        npm: ["npx", "knip@{version}"],
        pnpm: ["pnpm", "dlx", "knip@{version}"],
        yarn: ["yarn", "dlx", "knip@{version}"],
      },
      interactive: false,
    },
  ],
});
