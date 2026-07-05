import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const biomeCliProbe = defineCliCommandProbe({
  exportName: "biomeCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "biome",
  package: "@biomejs/biome",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "@biomejs/biome@{version}", "--help"],
  docs: [{ kind: "docs", url: "https://biomejs.dev/reference/configuration/", confidence: "high" }],
  commands: [
    {
      id: "init",
      packageManagers: {
        npm: ["npx", "@biomejs/biome@{version}", "init"],
        pnpm: ["pnpm", "dlx", "@biomejs/biome@{version}", "init"],
        yarn: ["yarn", "dlx", "@biomejs/biome@{version}", "init"],
      },
      interactive: false,
    },
  ],
});
