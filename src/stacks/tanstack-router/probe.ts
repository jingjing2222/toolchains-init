import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const tanStackRouterCliProbe = defineCliCommandProbe({
  exportName: "tanStackRouterCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "tanstack-router",
  package: "@tanstack/cli",
  distTag: "latest",
  helpCommand: ["npx", "--yes", "@tanstack/cli@{version}", "create", "--help"],
  commands: [
    {
      id: "create-router",
      packageManagers: {
        npm: ["npx", "@tanstack/cli@{version}", "create"],
        pnpm: ["pnpm", "dlx", "@tanstack/cli@{version}", "create"],
        yarn: ["yarn", "dlx", "@tanstack/cli@{version}", "create"],
      },
      flags: {
        routerOnly: { type: "boolean", cliName: "--router-only", supported: true },
        targetDir: { type: "string", cliName: "--target-dir", supported: true },
        force: { type: "boolean", cliName: "--force", supported: true },
        noInstall: { type: "boolean", cliName: "--no-install", supported: true },
        noGit: { type: "boolean", cliName: "--no-git", supported: true },
        noToolchain: { type: "boolean", cliName: "--no-toolchain", supported: true },
        noExamples: { type: "boolean", cliName: "--no-examples", supported: true },
        noIntent: { type: "boolean", cliName: "--no-intent", supported: true },
        packageManager: {
          type: "enum",
          cliName: "--package-manager",
          values: ["npm", "pnpm", "yarn"],
          supported: true,
        },
        framework: {
          type: "enum",
          cliName: "--framework",
          values: ["React", "Solid"],
          supported: true,
        },
        yes: { type: "boolean", cliName: "--yes", supported: true },
        interactive: { type: "boolean", cliName: "--interactive", supported: true },
      },
      interactive: true,
    },
  ],
});
