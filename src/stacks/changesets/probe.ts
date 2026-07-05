import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const changesetsCliProbe = defineCliCommandProbe({
  exportName: "changesetsCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "changesets",
  package: "@changesets/cli",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "@changesets/cli@{version}", "--help"],
  commands: [
    {
      id: "init",
      packageManagers: {
        npm: ["npx", "@changesets/cli@{version}", "init"],
        pnpm: ["pnpm", "dlx", "@changesets/cli@{version}", "init"],
        yarn: ["yarn", "dlx", "@changesets/cli@{version}", "init"],
      },
      interactive: false,
    },
  ],
});
