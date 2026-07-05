import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const oxlintCliProbe = defineCliCommandProbe({
  exportName: "oxlintCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "oxlint",
  package: "oxlint",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "oxlint@{version}", "--help"],
  commands: [
    {
      id: "init",
      packageManagers: {
        npm: ["npx", "oxlint@{version}"],
        pnpm: ["pnpm", "dlx", "oxlint@{version}"],
        yarn: ["yarn", "dlx", "oxlint@{version}"],
      },
      flags: {
        init: { type: "boolean", cliName: "--init", supported: true },
      },
      interactive: false,
    },
  ],
});
