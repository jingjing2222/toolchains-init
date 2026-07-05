import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

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
    expect(packageJson.devDependencies["@changesets/cli"]).toBe("^2.31.0");
    expect(packageJson.devDependencies["@biomejs/biome"]).toBe("^1.9.4");
    expect(packageJson.devDependencies.esbuild).toBeUndefined();
    expect(packageJson.devDependencies.eslint).toBe("^9.0.0");
    expect(packageJson.devDependencies.prettier).toBe("^3.0.0");
    expect(packageJson.devDependencies["react-doctor"]).toBeUndefined();
    expect(packageJson.scripts.format).toBeUndefined();
    expect(packageJson.scripts["format:check"]).toBe("prettier --check .");
    expect(packageJson.scripts.changeset).toBeUndefined();
    expect(packageJson.scripts.knip).toBe("npx knip@6.24.0");
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
    expect(packageJson.scripts.knip).toBe("npx knip@6.24.0");
  });

  it("rejects the removed init subcommand", async () => {
    const appDir = await createFreshViteProject();
    const result = spawnSync(process.execPath, [cliPath, "init", "--yes", "--no-install"], {
      cwd: appDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Unknown argument: init");
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

async function expectFileNotToExist(rootDir: string, file: string) {
  await expect(access(path.join(rootDir, file))).rejects.toThrow();
}

async function expectFileToExist(rootDir: string, file: string) {
  await expect(access(path.join(rootDir, file))).resolves.toBeUndefined();
}

async function expectEditorSettingsToExist(rootDir: string) {
  const vsCodeExtensions = await readJson(path.join(rootDir, ".vscode", "extensions.json"));
  expect(vsCodeExtensions.recommendations).toEqual(["biomejs.biome", "oxc.oxc-vscode"]);

  const vsCodeSettings = await readJson(path.join(rootDir, ".vscode", "settings.json"));
  expect(vsCodeSettings["biome.enabled"]).toBe(true);
  expect(vsCodeSettings["biome.requireConfiguration"]).toBe(true);
  expect(vsCodeSettings["oxc.fmt.configPath"]).toBe(".oxfmtrc.json");
  expect(vsCodeSettings["editor.codeActionsOnSave"]).toEqual({
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
