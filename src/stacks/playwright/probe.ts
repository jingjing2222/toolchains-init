import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const playwrightCliProbe = defineCliCommandProbe({
  exportName: "playwrightCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "playwright",
  package: "create-playwright",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "create-playwright@{version}", "--help"],
  docs: [{ kind: "docs", url: "https://playwright.dev/docs/intro", confidence: "medium" }],
  commands: [
    {
      id: "init",
      packageManagers: {
        npm: ["npm", "init", "playwright@{version}", "--"],
        pnpm: ["pnpm", "create", "playwright@{version}"],
        yarn: ["yarn", "create", "playwright@{version}"],
      },
      flags: {
        quiet: { type: "boolean", cliName: "--quiet", supported: true },
        lang: {
          type: "enum",
          cliName: "--lang",
          values: ["js", "TypeScript"],
          supported: true,
        },
        noBrowsers: { type: "boolean", cliName: "--no-browsers", supported: true },
      },
      interactive: true,
    },
  ],
});
