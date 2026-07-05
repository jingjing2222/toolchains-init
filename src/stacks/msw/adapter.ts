import { resolveCliCommand } from "../../core/cli-command-manifest";
import { hasPackageDependency, setManifestDevDependency } from "../../core/package-json-utils";
import { runCommand } from "../../core/run-command";
import { defineToolchain } from "../../core/toolchain-adapter";

const workerDirectory = "public";

export const msw = defineToolchain({
  feature: "msw",
  label: "MSW",
  catalog: "quality",
  order: 26,
  package: "msw",
  command: "init",
  hint: "Seamless REST/GraphQL API mocking library for browser and Node.js",
  docs: [
    {
      url: "https://mswjs.io/docs/cli/init/",
      confidence: "high",
      review: {
        reason: "Adapter appends `./public --save` to `msw init`.",
        files: ["src/stacks/msw/adapter.ts", "src/stacks/msw/init.test.ts"],
        sections: ["init", "Usage"],
        mustContain: ["npx msw init", "--save"],
        checks: [
          "Confirm `msw init <workerDirectory> --save` remains supported.",
          "Confirm generated worker filename still matches `public/mockServiceWorker.js`.",
        ],
      },
    },
    {
      url: "https://mswjs.io/docs/best-practices/managing-the-worker/",
      confidence: "high",
      review: {
        reason: "Adapter writes `package.json` MSW workerDirectory metadata.",
        files: ["src/stacks/msw/adapter.ts", "src/stacks/msw/init.test.ts"],
        sections: ["Managing the worker"],
        mustContain: ["workerDirectory", "mockServiceWorker.js"],
        checks: [
          "Confirm `package.json` `msw.workerDirectory` remains the documented way to persist worker paths.",
          "Confirm merging existing worker directories is still correct.",
        ],
      },
    },
  ],
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  isAvailable({ packageJson, packageManager }) {
    if (packageManager === "deno") {
      return false;
    }

    return hasPackageDependency(packageJson, "vite");
  },
  async run({ cwd, packageManager }) {
    const { mswCliManifest } = await import("./manifest");
    const command = resolveCliCommand(mswCliManifest, "init", packageManager);
    await runCommand(cwd, command.bin, [...command.args, `./${workerDirectory}`, "--save"]);
  },
  updatePackageJson({ cliManifest, packageJson }) {
    setManifestDevDependency(packageJson, cliManifest);
    packageJson.msw = {
      ...packageJson.msw,
      workerDirectory: mergeWorkerDirectory(packageJson.msw?.workerDirectory),
    };
  },
  targetFiles() {
    return [`${workerDirectory}/mockServiceWorker.js`];
  },
});

function mergeWorkerDirectory(current: string | string[] | undefined) {
  const directories = Array.isArray(current) ? current : current == null ? [] : [current];
  return [...new Set([...directories, workerDirectory])];
}
