import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getToolchainId } from "../src/core/toolchain-adapter";
import { biomeCliManifest } from "../src/stacks/biome";
import { changesetsCliManifest } from "../src/stacks/changesets";
import { knipCliManifest } from "../src/stacks/knip";
import { prettierCliManifest } from "../src/stacks/prettier";
import { reactDoctorCliManifest } from "../src/stacks/react-doctor";
import { toolchains } from "../src/stacks";

const cliPath = path.resolve("dist/cli.mjs");

describe("toolchains-init CLI", () => {
  it("prints the package version", async () => {
    const result = spawnSync(process.execPath, [cliPath, "--version"], {
      encoding: "utf8",
    });
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
      version: string;
    };

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  it("prints help", () => {
    const result = spawnSync(process.execPath, [cliPath, "--help"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("toolchains-init [--target path]");
    expect(result.stdout).toContain("--router file|code");
  });

  it("lists every generated toolchain ID in help", () => {
    const result = spawnSync(process.execPath, [cliPath, "--help"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--toolchains");
    expect(result.stdout).toContain("--package-manager");

    for (const toolchain of toolchains) {
      expect(result.stdout).toContain(getToolchainId(toolchain));
    }
  });

  it("recognizes help and version after other options", async () => {
    const helpResult = spawnSync(
      process.execPath,
      [cliPath, "--package-manager", "wat", "--help"],
      {
        encoding: "utf8",
      },
    );
    const versionResult = spawnSync(
      process.execPath,
      [cliPath, "--toolchains", "does-not-exist", "--version"],
      { encoding: "utf8" },
    );
    const helpWinsResult = spawnSync(process.execPath, [cliPath, "--version", "--help"], {
      encoding: "utf8",
    });
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
      version: string;
    };

    expect(helpResult.status).toBe(0);
    expect(helpResult.stdout).toContain("Usage:");
    expect(versionResult.status).toBe(0);
    expect(versionResult.stdout.trim()).toBe(packageJson.version);
    expect(helpWinsResult.status).toBe(0);
    expect(helpWinsResult.stdout).toContain("Usage:");
  });

  it("initializes a fresh Vite React project", async () => {
    const appDir = await createFreshViteProject();
    const result = spawnSync(process.execPath, [cliPath, "--yes", "--no-install"], {
      cwd: appDir,
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("toolchains-init is ready");

    const packageJson = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@tanstack/react-router"]).toBeUndefined();
    expect(packageJson.devDependencies["@tanstack/router-plugin"]).toBeUndefined();
    expect(packageJson.devDependencies["@playwright/test"]).toBeUndefined();
    expect(packageJson.devDependencies["@changesets/cli"]).toBe(changesetsCliManifest.version);
    expect(packageJson.devDependencies["@biomejs/biome"]).toBe(biomeCliManifest.version);
    expect(packageJson.devDependencies.esbuild).toBeUndefined();
    expect(packageJson.devDependencies.eslint).toBe("^9.0.0");
    expect(packageJson.devDependencies.prettier).toBe(prettierCliManifest.version);
    expect(packageJson.devDependencies["react-doctor"]).toBeUndefined();
    expect(packageJson.scripts.format).toBe("prettier --write .");
    expect(packageJson.scripts["format:check"]).toBe("prettier --check .");
    expect(packageJson.scripts.changeset).toBeUndefined();
    expect(packageJson.scripts.knip).toBe(`npx knip@${knipCliManifest.version}`);
    expect(packageJson.scripts.lint).toBe("eslint .");
    expect(packageJson.scripts["version-packages"]).toBeUndefined();
    expect(packageJson.scripts["test:e2e"]).toBeUndefined();
    expect(packageJson.scripts.verify).toBeUndefined();

    await expectFileNotToExist(appDir, "AGENTS.md");
    await expectFileNotToExist(appDir, "doctor.config.ts");
    await expectFileNotToExist(appDir, ".oxfmtrc.json");
    await expectFileNotToExist(appDir, ".oxlintrc.json");
    await expectEditorSettingsToExist(appDir);
    await expectFileNotToExist(appDir, ".changeset/config.json");
    await expectFileNotToExist(appDir, "playwright.config.ts");
    await expectFileNotToExist(appDir, "playwright.config.cjs");
    await expectFileNotToExist(appDir, "tests/example.spec.ts");
    await expectFileNotToExist(appDir, "src/e2e");
    await expectFileNotToExist(appDir, "src/pages/home/HomePage.e2e.ts");
    await expectFileToExist(appDir, ".prettierrc");
    await expectFileToExist(appDir, "eslint.config.js");
    await expectFileToExist(appDir, "biome.json");
    await expectFileNotToExist(appDir, "scripts/build-e2e-tests.mjs");
  });

  it("does not scaffold router files when external CLIs are skipped", async () => {
    const appDir = await createFreshViteProject();
    const result = spawnSync(process.execPath, [cliPath, "--yes", "--no-install"], {
      cwd: appDir,
      encoding: "utf8",
    });

    expect(result.status, result.stderr).toBe(0);

    await expectFileNotToExist(appDir, "src/routes/index.tsx");
    await expectFileNotToExist(appDir, "src/routeTree.gen.ts");
    await expectFileNotToExist(appDir, "src/routes/routeTree.ts");
  });

  it("uses the current directory as the toolchain target", async () => {
    const appDir = await createFreshViteProject();
    const nestedDir = path.join(appDir, "src", "pages", "home");
    const result = spawnSync(process.execPath, [cliPath, "--yes", "--no-install"], {
      cwd: nestedDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Could not find package.json in target directory:");
  });

  it("can target an app package from a workspace root", async () => {
    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-workspace-"));
    const appDir = await createFreshViteProject(path.join(workspaceDir, "apps", "web"));
    await writeFile(
      path.join(workspaceDir, "package.json"),
      `${JSON.stringify({ private: true, workspaces: ["apps/*"] }, null, 2)}\n`,
    );
    const result = spawnSync(
      process.execPath,
      [cliPath, "--target", "apps/web", "--yes", "--no-install"],
      {
        cwd: workspaceDir,
        encoding: "utf8",
      },
    );

    expect(result.status, result.stderr).toBe(0);
    await expectFileToExist(appDir, ".vscode/settings.json");
    await expectFileNotToExist(workspaceDir, ".vscode/settings.json");
    const packageJson = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts.knip).toBe(`npx knip@${knipCliManifest.version}`);
  });

  it("initializes only explicitly selected toolchains without prompting", async () => {
    const appDir = await createFreshViteProject();
    const result = spawnSync(
      process.execPath,
      [
        cliPath,
        "--toolchains",
        "knip,react-doctor",
        "--package-manager",
        "npm",
        "--yes",
        "--no-install",
      ],
      {
        cwd: appDir,
        encoding: "utf8",
      },
    );

    expect(result.status, cliOutput(result)).toBe(0);

    const packageJson = JSON.parse(await readFile(path.join(appDir, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(packageJson.scripts.knip).toBe(`npx knip@${knipCliManifest.version}`);
    expect(packageJson.scripts["react-doctor"]).toBe(
      `npx react-doctor@${reactDoctorCliManifest.version}`,
    );
    expect(packageJson.scripts.typecheck).toBe("tsc --build");
    expect(packageJson.devDependencies["@changesets/cli"]).toBeUndefined();
    expect(packageJson.devDependencies["@biomejs/biome"]).toBe("^1.9.4");
    await expectFileNotToExist(appDir, ".vscode/settings.json");
  });

  it("rejects unknown options", async () => {
    const appDir = await createFreshViteProject();
    const packageJsonPath = path.join(appDir, "package.json");
    const packageJsonBefore = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(
      process.execPath,
      [cliPath, "--does-not-exist", "--yes", "--no-install"],
      {
        cwd: appDir,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toMatch(/unknown option/i);
    expect(cliOutput(result)).toContain("--does-not-exist");
    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonBefore);
  });

  it("rejects unknown toolchain IDs", async () => {
    const appDir = await createFreshViteProject();
    const packageJsonPath = path.join(appDir, "package.json");
    const packageJsonBefore = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(
      process.execPath,
      [cliPath, "--toolchains", "knip,does-not-exist", "--yes", "--no-install"],
      {
        cwd: appDir,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toMatch(/unknown toolchain/i);
    expect(cliOutput(result)).toContain("does-not-exist");
    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonBefore);
  });

  it.each([
    ["missing", ["--toolchains", "--yes", "--no-install"]],
    ["empty", ["--toolchains=", "--yes", "--no-install"]],
  ])("rejects a %s toolchain selection value", async (_case, args) => {
    const appDir = await createFreshViteProject();
    const packageJsonPath = path.join(appDir, "package.json");
    const packageJsonBefore = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(process.execPath, [cliPath, ...args], {
      cwd: appDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toContain("--toolchains");
    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonBefore);
  });

  it("rejects a known toolchain that is unavailable for the target", async () => {
    const appDir = await createFreshViteProject();
    const packageJsonPath = path.join(appDir, "package.json");
    const packageJsonBefore = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(
      process.execPath,
      [cliPath, "--toolchains", "hot-updater", "--package-manager", "npm", "--yes", "--no-install"],
      {
        cwd: appDir,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toMatch(/not available/i);
    expect(cliOutput(result)).toContain("hot-updater");
    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonBefore);
    await expectFileNotToExist(appDir, ".vscode/settings.json");
  });

  it("rejects an interactive-only Hot Updater initializer before writing", async () => {
    const appDir = await createFreshReactNativeProject();
    const packageJsonPath = path.join(appDir, "package.json");
    const packageJsonBefore = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(
      process.execPath,
      [cliPath, "--toolchains", "hot-updater", "--package-manager", "npm", "--yes"],
      {
        cwd: appDir,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toContain("Interactive-only");
    expect(cliOutput(result)).toContain("hot-updater");
    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonBefore);
    await expectFileNotToExist(appDir, "hot-updater.config.ts");
  });

  it("keeps legacy --yes failures side-effect free", async () => {
    const appDir = await createFreshViteProject();
    const packageJsonPath = path.join(appDir, "package.json");
    const packageJsonBefore = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(process.execPath, [cliPath, "--package-manager", "npm", "--yes"], {
      cwd: appDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toContain("Interactive-only");
    expect(cliOutput(result)).toContain("eslint");
    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonBefore);
    await expectFileNotToExist(appDir, ".vscode/settings.json");
  });

  it("rejects an interactive-only ESLint initializer before writing", async () => {
    const appDir = await createFreshViteProject();
    const packageJsonPath = path.join(appDir, "package.json");
    const packageJsonBefore = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(
      process.execPath,
      [cliPath, "--toolchains", "eslint", "--package-manager", "npm", "--yes"],
      {
        cwd: appDir,
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toContain("Interactive-only");
    expect(cliOutput(result)).toContain("eslint");
    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonBefore);
    await expectFileNotToExist(appDir, ".vscode/settings.json");
  });

  it("rejects the removed init subcommand", async () => {
    const appDir = await createFreshViteProject();
    const result = spawnSync(process.execPath, [cliPath, "init", "--yes", "--no-install"], {
      cwd: appDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toContain("Unknown argument: init");
  });
});

async function createFreshViteProject(appDir?: string) {
  appDir ??= await mkdtemp(path.join(os.tmpdir(), "toolchains-init-test-"));
  await mkdir(appDir, { recursive: true });
  await writeFile(
    path.join(appDir, "package.json"),
    `${JSON.stringify(
      {
        name: "smoke-app",
        version: "0.0.0",
        private: true,
        packageManager: "yarn@4.17.0",
        type: "module",
        scripts: {
          build: "tsc -b && vite build",
          dev: "vite",
          "format:check": "prettier --check .",
          lint: "eslint .",
          preview: "vite preview",
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
        devDependencies: {
          "@biomejs/biome": "^1.9.4",
          "@types/react": "^18.0.0",
          "@types/react-dom": "^18.0.0",
          "@vitejs/plugin-react": "^4.3.4",
          eslint: "^9.0.0",
          prettier: "^3.0.0",
          typescript: "~5.7.2",
          vite: "^6.2.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(path.join(appDir, ".prettierrc"), "{}\n");
  await writeFile(path.join(appDir, "eslint.config.js"), "export default [];\n");
  await writeFile(path.join(appDir, "biome.json"), "{}\n");
  await mkdir(path.join(appDir, "src", "pages", "home"), { recursive: true });
  return appDir;
}

async function createFreshReactNativeProject() {
  const appDir = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-react-native-"));
  await writeFile(
    path.join(appDir, "package.json"),
    `${JSON.stringify(
      {
        name: "react-native-smoke",
        private: true,
        dependencies: {
          react: "19.2.3",
          "react-native": "0.86.0",
        },
      },
      null,
      2,
    )}\n`,
  );
  return appDir;
}

async function expectFileNotToExist(rootDir: string, file: string) {
  await expect(access(path.join(rootDir, file))).rejects.toThrow();
}

async function expectFileToExist(rootDir: string, file: string) {
  await expect(access(path.join(rootDir, file))).resolves.toBeUndefined();
}

async function expectEditorSettingsToExist(rootDir: string) {
  const vsCodeExtensions = await readJson(path.join(rootDir, ".vscode", "extensions.json"));
  expect(vsCodeExtensions.recommendations).toEqual([
    "biomejs.biome",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "oxc.oxc-vscode",
  ]);

  const vsCodeSettings = await readJson(path.join(rootDir, ".vscode", "settings.json"));
  expect(vsCodeSettings["biome.enabled"]).toBe(true);
  expect(vsCodeSettings["biome.requireConfiguration"]).toBe(true);
  expect(vsCodeSettings["oxc.fmt.configPath"]).toBe(".oxfmtrc.json");
  expect(vsCodeSettings["editor.codeActionsOnSave"]).toEqual({
    "source.fixAll.eslint": "always",
    "source.fixAll.oxc": "always",
  });
  expect(vsCodeSettings["[typescript]"]).toBeUndefined();

  const zedSettings = await readJson(path.join(rootDir, ".zed", "settings.json"));
  expect(zedSettings).toMatchObject({
    lsp: {
      biome: {
        settings: {
          require_config_file: true,
        },
      },
      oxfmt: {
        initialization_options: {
          settings: {
            "fmt.configPath": ".oxfmtrc.json",
            run: "onSave",
          },
        },
      },
      oxlint: {
        initialization_options: {
          settings: {
            run: "onType",
          },
        },
      },
    },
  });
  expect(zedSettings.languages).toBeUndefined();
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
}

function cliOutput(result: ReturnType<typeof spawnSync>) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}
