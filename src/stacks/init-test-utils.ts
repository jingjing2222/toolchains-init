import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect } from "vitest";
import type { PackageJson, ToolchainOptions } from "../core/types";

const execFileAsync = promisify(execFile);

export const adapterInitTimeout = 120_000;

export function options(features: ToolchainOptions["features"]): ToolchainOptions {
  return { features, routerMode: "file" };
}

export async function createFreshViteProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-adapter-"));
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src", "main.tsx"), "console.log('ready');\n");
  await writeFile(
    path.join(cwd, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
  );
  await writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify(createPackageJson(), null, 2)}\n`,
  );
  return cwd;
}

export async function createFreshYarnPnpProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-yarn-sdks-"));
  await writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify(
      {
        name: "toolchains-init-yarn-sdks-smoke",
        version: "0.0.0",
        private: true,
        packageManager: "yarn@4.17.0",
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(cwd, ".yarnrc.yml"), "nodeLinker: pnp\n");
  await execFileAsync("corepack", ["yarn", "install"], { cwd });
  return cwd;
}

function createPackageJson(): PackageJson {
  return {
    name: "toolchains-init-adapter-smoke",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      build: "tsc -b && vite build",
      dev: "vite",
    },
    dependencies: {
      "@vitejs/plugin-react": "^4.3.4",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      typescript: "~5.7.2",
      vite: "^6.2.0",
    },
    devDependencies: {},
  } as PackageJson;
}

export async function readPackageJson(cwd: string): Promise<PackageJson> {
  return readJson(path.join(cwd, "package.json")) as Promise<PackageJson>;
}

export async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
}

export async function expectFileToExist(cwd: string, file: string) {
  await expect(access(path.join(cwd, file))).resolves.toBeUndefined();
}

export async function expectFileNotToExist(cwd: string, file: string) {
  await expect(access(path.join(cwd, file))).rejects.toThrow();
}
