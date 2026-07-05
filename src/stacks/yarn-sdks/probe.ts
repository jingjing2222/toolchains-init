import { defineCliCommandProbe } from "../../core/cli-command-probe";

export const yarnSdksCliProbe = defineCliCommandProbe({
  exportName: "yarnSdksCliManifest",
  manifestPath: new URL("./manifest.ts", import.meta.url),
  tool: "yarn-sdks",
  package: "@yarnpkg/sdks",
  distTag: "latest",
  commands: [
    {
      id: "vscode",
      packageManagers: {
        yarn: ["yarn", "dlx", "@yarnpkg/sdks@{version}", "vscode"],
      },
      interactive: false,
    },
  ],
});
