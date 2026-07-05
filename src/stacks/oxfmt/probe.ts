import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const oxfmtCliProbe = defineCliCommandProbe({
  exportName: "oxfmtCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "oxfmt",
  package: "oxfmt",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "oxfmt@{version}", "--help"],
  commands: [
    {
      id: "init",
      packageManagers: {
        npm: ["npx", "oxfmt@{version}"],
        pnpm: ["pnpm", "dlx", "oxfmt@{version}"],
        yarn: ["yarn", "dlx", "oxfmt@{version}"],
      },
      flags: {
        init: { type: "boolean", cliName: "--init", supported: true },
      },
      interactive: false,
    },
  ],
});
