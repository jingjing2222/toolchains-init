import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineCliCommandManifest, resolveCliCommand } from "../src/core/cli-command-manifest";
import { defineToolchain, getToolchainCliTool } from "../src/core/toolchain-adapter";
import {
  cliCommandManifestData,
  cliCommandManifests,
  getCliCommandManifest,
  toolchains,
} from "../src/stacks";
import {
  findOrphanGeneratedFiles,
  parseHelpFlags,
  removeOrphanGeneratedFiles,
  resolvePackageManagerCommands,
  runHelpCommand,
  validateDiscoveredToolchains,
} from "../scripts/update-cli-manifests";
import packageJson from "../package.json" with { type: "json" };

const playwrightCliManifest = getCliCommandManifest("playwright");
if (playwrightCliManifest == null) {
  throw new Error("Missing Playwright CLI command manifest");
}

describe("CLI command manifests", () => {
  it("registers every CLI-backed toolchain command", () => {
    const expectedTools = toolchains
      .filter((toolchain) => toolchain.cli != null)
      .map((toolchain) => getToolchainCliTool(toolchain));

    expect(cliCommandManifestData.map((manifest) => manifest.tool)).toEqual(expectedTools);
    expect(cliCommandManifests.map((manifest) => manifest.tool)).toEqual(expectedTools);
  });

  it("resolves every command for its declared package managers", () => {
    for (const manifest of cliCommandManifests) {
      for (const command of manifest.commands) {
        for (const packageManager of ["npm", "pnpm", "yarn", "bun", "deno"] as const) {
          if (command.packageManagers[packageManager] == null) {
            continue;
          }

          const resolved = resolveCliCommand(manifest, command.id, packageManager);

          expect(resolved.bin.length).toBeGreaterThan(0);
          expect([resolved.bin, ...resolved.args].join(" ")).not.toContain("@latest");
        }
      }
    }
  });

  it("derives CLI flags from help output, not a hand-written subset", () => {
    expect(playwrightCliManifest.commands[0]?.flags).toMatchObject({
      browser: { cliName: "--browser" },
      noBrowsers: { cliName: "--no-browsers" },
      lang: { cliName: "--lang" },
    });

    const tanStackCliManifest = getCliCommandManifest("tanstack-router");
    expect(tanStackCliManifest?.commands[0]?.flags).toMatchObject({
      deployment: { cliName: "--deployment" },
      routerOnly: { cliName: "--router-only" },
    });

    const storybookCliManifest = getCliCommandManifest("storybook");
    expect(storybookCliManifest?.commands[0]?.flags).toMatchObject({
      force: { cliName: "--force" },
      skipInstall: { cliName: "--skip-install" },
      yes: { cliName: "--yes" },
    });
  });

  it("extracts long flag names without interpreting their value syntax", () => {
    expect(
      Object.fromEntries(
        parseHelpFlags(`
  -p, --preset [name]        use a preset configuration
                             --preset=base-nova (default: false)
  --workdir string           path to a project directory
  --format                   [String] formatter name
  --output, -o choice        output format (choices: json, yaml, table)
  --import <path|package>    import a config path or package
  --level                    level ('suggestion' | 'warning' | 'error')
  --cwd                      Custom current worker directory             [string]
  --save                     Save the worker directory                   [boolean]
  --format <format>             file format (choices: "yaml",
                                "yml", "json", "jsonc", default: "yaml")
  -t, --template <template>     template (next, start, vite,
                                react-router, laravel, astro)
  --secretlintignore [path:String] path to the ignore file
  --secretlintrcJSON [String] a JSON config string
  --ignore-rules <rules...>     rules to ignore (choices: "no-resolution",
                                "cjs-only-exports-default", "named-exports",
                                default: [])
  --migrate=SOURCE              migrate from a specified source
  -c, --config=PATH             path to configuration (.json, .jsonc, knip.(js|ts))
`).map((flag) => [flag.cliName, flag]),
      ),
    ).toEqual({
      "--config": { cliName: "--config" },
      "--cwd": { cliName: "--cwd" },
      "--format": { cliName: "--format" },
      "--ignore-rules": { cliName: "--ignore-rules" },
      "--import": { cliName: "--import" },
      "--level": { cliName: "--level" },
      "--migrate": { cliName: "--migrate" },
      "--output": { cliName: "--output" },
      "--preset": { cliName: "--preset" },
      "--save": { cliName: "--save" },
      "--secretlintignore": { cliName: "--secretlintignore" },
      "--secretlintrcJSON": { cliName: "--secretlintrcJSON" },
      "--template": { cliName: "--template" },
      "--workdir": { cliName: "--workdir" },
    });
  });

  it("keeps wrapped descriptions from creating extra flag names", () => {
    expect(
      parseHelpFlags(`
  --format <format>             file format (choices: "yaml",
                                "yml", "json", "jsonc", default: "yaml")
`).map((flag) => flag.cliName),
    ).toEqual(["--format"]);
  });

  it("rejects ambiguous generated flag identities", () => {
    const manifest = {
      commands: [
        {
          flags: {
            first: { cliName: "--same" },
            second: { cliName: "--same" },
          },
          id: "init",
          packageManagers: { npm: ["npx", "example@{version}"] },
        },
      ],
      package: "example",
      schemaVersion: "toolchains-init/cli-command-manifest/v1",
      sources: [],
      tool: "example",
      version: "1.0.0",
    };

    expect(() => defineCliCommandManifest(manifest)).toThrow("Duplicate CLI flag name");
  });

  it("keeps docs-backed adapter review metadata in generated manifests", () => {
    for (const manifest of cliCommandManifests) {
      expect(
        manifest.sources.some((source) => source.kind === "docs" && source.review != null),
      ).toBe(true);
    }

    const mswCliManifest = getCliCommandManifest("msw");
    expect(mswCliManifest?.sources).toContainEqual(
      expect.objectContaining({
        kind: "docs",
        url: "https://mswjs.io/docs/cli/init/",
        review: expect.objectContaining({
          files: ["src/stacks/msw/adapter.ts", "src/stacks/msw/init.test.ts"],
          reason: expect.stringContaining("bare msw init command unchanged"),
        }),
      }),
    );
  });

  it("resolves pinned Playwright init commands by package manager", () => {
    expect(resolveCliCommand(playwrightCliManifest, "init", "npm")).toEqual({
      bin: "npm",
      args: ["init", `playwright@${playwrightCliManifest.version}`, "--"],
    });
    expect(resolveCliCommand(playwrightCliManifest, "init", "pnpm")).toEqual({
      bin: "pnpm",
      args: ["create", `playwright@${playwrightCliManifest.version}`],
    });
    expect(resolveCliCommand(playwrightCliManifest, "init", "yarn")).toEqual({
      bin: "yarn",
      args: ["create", `playwright@${playwrightCliManifest.version}`],
    });
    expect(resolveCliCommand(playwrightCliManifest, "init", "bun")).toEqual({
      bin: "bun",
      args: ["create", `playwright@${playwrightCliManifest.version}`],
    });
    expect(resolveCliCommand(playwrightCliManifest, "init", "deno")).toEqual({
      bin: "deno",
      args: ["x", "-A", `npm:create-playwright@${playwrightCliManifest.version}`],
    });
  });

  it("infers package-manager commands from the CLI package shape", () => {
    const biomeCliManifest = getCliCommandManifest("biome");
    const eslintCliManifest = getCliCommandManifest("eslint");
    const knipCliManifest = getCliCommandManifest("knip");
    const oxfmtCliManifest = getCliCommandManifest("oxfmt");
    const oxlintCliManifest = getCliCommandManifest("oxlint");
    const prettierCliManifest = getCliCommandManifest("prettier");
    const storybookCliManifest = getCliCommandManifest("storybook");
    const yarnSdksCliManifest = getCliCommandManifest("yarn-sdks");

    expect(biomeCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "@biomejs/biome@{version}", "init"],
      pnpm: ["pnpm", "dlx", "@biomejs/biome@{version}", "init"],
      yarn: ["yarn", "dlx", "@biomejs/biome@{version}", "init"],
      bun: ["bunx", "@biomejs/biome@{version}", "init"],
      deno: ["deno", "x", "-A", "npm:@biomejs/biome@{version}", "init"],
    });
    expect(knipCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "knip@{version}"],
      pnpm: ["pnpm", "dlx", "knip@{version}"],
      yarn: ["yarn", "dlx", "knip@{version}"],
      bun: ["bunx", "knip@{version}"],
      deno: ["deno", "x", "-A", "npm:knip@{version}"],
    });
    expect(oxfmtCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "oxfmt@{version}", "--init"],
      pnpm: ["pnpm", "dlx", "oxfmt@{version}", "--init"],
      yarn: ["yarn", "dlx", "oxfmt@{version}", "--init"],
      bun: ["bunx", "oxfmt@{version}", "--init"],
      deno: ["deno", "x", "-A", "npm:oxfmt@{version}", "--init"],
    });
    expect(oxlintCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "oxlint@{version}", "--init"],
      pnpm: ["pnpm", "dlx", "oxlint@{version}", "--init"],
      yarn: ["yarn", "dlx", "oxlint@{version}", "--init"],
      bun: ["bunx", "oxlint@{version}", "--init"],
      deno: ["deno", "x", "-A", "npm:oxlint@{version}", "--init"],
    });
    expect(prettierCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "prettier@{version}", "--check", "."],
      pnpm: ["pnpm", "dlx", "prettier@{version}", "--check", "."],
      yarn: ["yarn", "dlx", "prettier@{version}", "--check", "."],
      bun: ["bunx", "prettier@{version}", "--check", "."],
      deno: ["deno", "x", "-A", "npm:prettier@{version}", "--check", "."],
    });
    expect(eslintCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "@eslint/create-config@{version}"],
      pnpm: ["pnpm", "dlx", "@eslint/create-config@{version}"],
      yarn: ["yarn", "dlx", "@eslint/create-config@{version}"],
      bun: ["bunx", "@eslint/create-config@{version}"],
      deno: ["deno", "x", "-A", "npm:@eslint/create-config@{version}"],
    });
    expect(yarnSdksCliManifest?.commands[0]?.packageManagers).toEqual({
      npm: ["npx", "@yarnpkg/sdks@{version}", "vscode"],
      pnpm: ["pnpm", "dlx", "@yarnpkg/sdks@{version}", "vscode"],
      yarn: ["yarn", "dlx", "@yarnpkg/sdks@{version}", "vscode"],
      bun: ["bunx", "@yarnpkg/sdks@{version}", "vscode"],
      deno: ["deno", "x", "-A", "npm:@yarnpkg/sdks@{version}", "vscode"],
    });
    expect(yarnSdksCliManifest?.sources.map((source) => source.kind)).toEqual(["npm", "docs"]);
    expect(storybookCliManifest?.commands[0]?.packageManagers).toEqual({
      npm: ["npm", "init", "storybook@{version}", "--"],
      pnpm: ["pnpm", "create", "storybook@{version}"],
      yarn: ["yarn", "create", "storybook@{version}"],
      bun: ["bun", "create", "storybook@{version}"],
      deno: ["deno", "x", "-A", "npm:create-storybook@{version}"],
    });
  });

  it("keeps flag-only initializers in the generated command identity", () => {
    const oxfmtCliManifest = getCliCommandManifest("oxfmt");
    const oxlintCliManifest = getCliCommandManifest("oxlint");
    if (oxfmtCliManifest == null || oxlintCliManifest == null) {
      throw new Error("Missing Oxc CLI manifests");
    }

    expect(resolveCliCommand(oxfmtCliManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`oxfmt@${oxfmtCliManifest.version}`, "--init"],
    });
    expect(resolveCliCommand(oxlintCliManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`oxlint@${oxlintCliManifest.version}`, "--init"],
    });
  });

  it("preserves package scopes when inferring create commands", () => {
    expect(
      resolvePackageManagerCommands(
        {
          commandId: "init",
          distTag: "latest",
          docs: [],
          exportName: "scopedCreateCliManifest",
          help: undefined,
          commandArgs: ["--template", "react"],
          packageManagers: ["npm", "pnpm", "yarn", "bun", "deno"],
          packageName: "@scope/create-widget",
          runner: "auto",
          stackDir: "scoped-create",
          subcommand: "init",
          tool: "scoped-create",
        },
        "1.2.3",
      ),
    ).toEqual({
      npm: ["npm", "init", "@scope/widget@{version}", "--", "--template", "react"],
      pnpm: ["pnpm", "create", "@scope/widget@{version}", "--template", "react"],
      yarn: ["yarn", "create", "@scope/widget@{version}", "--template", "react"],
      bun: ["bun", "create", "@scope/widget@{version}", "--template", "react"],
      deno: ["deno", "x", "-A", "npm:@scope/create-widget@{version}", "--template", "react"],
    });
  });

  it("appends static command identity to custom runner templates", () => {
    expect(
      resolvePackageManagerCommands(
        {
          commandArgs: ["--check", "."],
          commandId: "check",
          distTag: "latest",
          docs: [],
          exportName: "exampleCliManifest",
          help: undefined,
          packageManagers: ["npm"],
          packageName: "example",
          runner: { npm: ["npx", "example@{version}"] },
          stackDir: "example",
          subcommand: null,
          tool: "example",
        },
        "1.2.3",
      ),
    ).toEqual({ npm: ["npx", "example@{version}", "--check", "."] });
  });

  it("keeps help output from CLIs that exit non-zero", async () => {
    await expect(
      runHelpCommand([
        process.execPath,
        "-e",
        "console.log('--flag  useful help'); process.exit(2)",
      ]),
    ).resolves.toContain("--flag  useful help");
  });

  it("rejects non-help output from CLIs that exit non-zero", async () => {
    await expect(
      runHelpCommand([
        process.execPath,
        "-e",
        "console.error('configuration is invalid'); process.exit(2)",
      ]),
    ).rejects.toThrow();
  });

  it("bounds CLI help probes even when a child process stays open", async () => {
    await expect(
      runHelpCommand([process.execPath, "-e", "setTimeout(() => {}, 10_000)"], 50),
    ).rejects.toThrow();
  });

  it("rejects duplicate generated identities before probing external sources", async () => {
    const biome = toolchains.find((toolchain) => toolchain.feature === "biome");
    const eslint = toolchains.find((toolchain) => toolchain.feature === "eslint");
    if (biome?.cli == null || eslint?.cli == null) {
      throw new Error("Missing CLI-backed test adapters");
    }

    const discoveredBiome = { adapter: biome, exportName: "biome", stackDir: "biome" };
    await expect(
      validateDiscoveredToolchains([
        discoveredBiome,
        {
          adapter: {
            ...eslint,
            cli: { ...eslint.cli, tool: getToolchainCliTool(biome) },
          },
          exportName: "eslint",
          stackDir: "eslint",
        },
      ]),
    ).rejects.toThrow("Duplicate CLI tool");

    await expect(
      validateDiscoveredToolchains([
        discoveredBiome,
        {
          adapter: { ...eslint, feature: biome.feature },
          exportName: "eslint",
          stackDir: "eslint",
        },
      ]),
    ).rejects.toThrow("Duplicate feature");

    await expect(
      validateDiscoveredToolchains([
        discoveredBiome,
        { adapter: eslint, exportName: "biome", stackDir: "eslint" },
      ]),
    ).rejects.toThrow("Duplicate adapter export name");

    await expect(
      validateDiscoveredToolchains([
        discoveredBiome,
        {
          adapter: {
            ...eslint,
            cli: {
              ...eslint.cli,
              exportName: biome.cli.exportName ?? `${biome.feature}CliManifest`,
            },
          },
          exportName: "eslint",
          stackDir: "eslint",
        },
      ]),
    ).rejects.toThrow("Duplicate manifest export name");

    await expect(
      validateDiscoveredToolchains([
        discoveredBiome,
        {
          adapter: {
            ...eslint,
            cli: {
              ...eslint.cli,
              stackDir: biome.cli.stackDir ?? getToolchainCliTool(biome),
            },
          },
          exportName: "eslint",
          stackDir: "eslint",
        },
      ]),
    ).rejects.toThrow("Duplicate stack path");
  });

  it("rejects generated stack paths outside a single safe stack directory", async () => {
    const biome = toolchains.find((toolchain) => toolchain.feature === "biome");
    if (biome?.cli == null) {
      throw new Error("Missing Biome adapter");
    }

    await expect(
      validateDiscoveredToolchains([
        {
          adapter: { ...biome, cli: { ...biome.cli, stackDir: "../outside" } },
          exportName: "biome",
          stackDir: "biome",
        },
      ]),
    ).rejects.toThrow("stack path must be one lowercase kebab-case directory");
  });

  it("rejects features that normalize to the same user-facing selector", async () => {
    const hotUpdater = toolchains.find((toolchain) => toolchain.feature === "hotUpdater");
    const biome = toolchains.find((toolchain) => toolchain.feature === "biome");
    if (hotUpdater == null || biome == null) {
      throw new Error("Missing selector collision test adapters");
    }

    await expect(
      validateDiscoveredToolchains([
        { adapter: hotUpdater, exportName: "hotUpdater", stackDir: "hot-updater" },
        {
          adapter: { ...biome, feature: "hot-updater" as typeof biome.feature },
          exportName: "hyphenatedHotUpdater",
          stackDir: "hyphenated-hot-updater",
        },
      ]),
    ).rejects.toThrow("Duplicate toolchain selector: hot-updater");
  });

  it("requires canonical lowerCamelCase feature ids", async () => {
    const biome = toolchains.find((toolchain) => toolchain.feature === "biome");
    if (biome == null) {
      throw new Error("Missing feature syntax test adapter");
    }

    await expect(
      validateDiscoveredToolchains([
        {
          adapter: { ...biome, feature: "URLParser" as typeof biome.feature },
          exportName: "urlParser",
          stackDir: "url-parser",
        },
      ]),
    ).rejects.toThrow("must use lowerCamelCase");
  });

  it("requires complete docs review metadata and existing review files", async () => {
    const adapter = defineToolchain({
      feature: "biome",
      label: "Example",
      package: "example",
      command: "init",
      docs: [
        {
          url: "https://example.com/docs",
          confidence: "high",
          review: {
            reason: "Review the initializer contract.",
            files: ["test/does-not-exist.ts"],
            mustContain: ["init"],
            checks: ["Confirm init remains supported."],
          },
        },
      ],
    });

    await expect(
      validateDiscoveredToolchains([{ adapter, exportName: "example", stackDir: "example" }]),
    ).rejects.toThrow("references a missing review file");

    const incomplete = defineToolchain({
      ...adapter,
      package: "example",
      command: "init",
      docs: [
        {
          url: "https://example.com/docs",
          confidence: "high",
          review: {
            reason: "Review the initializer contract.",
            files: ["test/cli-command-manifest.test.ts"],
            mustContain: ["init"],
            checks: [],
          },
        },
      ],
    });
    await expect(
      validateDiscoveredToolchains([
        { adapter: incomplete, exportName: "example", stackDir: "example" },
      ]),
    ).rejects.toThrow("review.checks must contain at least one nonempty value");

    const absoluteReviewFile = defineToolchain({
      feature: "biome",
      label: "Example",
      package: "example",
      command: "init",
      docs: [
        {
          url: "https://example.com/docs",
          confidence: "high",
          review: {
            reason: "Review the initializer contract.",
            files: [path.resolve("test/cli-command-manifest.test.ts")],
            mustContain: ["init"],
            checks: ["Confirm init remains supported."],
          },
        },
      ],
    });
    await expect(
      validateDiscoveredToolchains([
        { adapter: absoluteReviewFile, exportName: "example", stackDir: "example" },
      ]),
    ).rejects.toThrow("review file must be repo-relative");
  });

  it("requires at least one unique package-manager command contract", async () => {
    const biome = toolchains.find((toolchain) => toolchain.feature === "biome");
    if (biome?.cli == null) {
      throw new Error("Missing Biome CLI adapter");
    }

    await expect(
      validateDiscoveredToolchains([
        {
          adapter: { ...biome, cli: { ...biome.cli, packageManagers: [] } },
          exportName: "biome",
          stackDir: "biome",
        },
      ]),
    ).rejects.toThrow("at least one package manager");
    await expect(
      validateDiscoveredToolchains([
        {
          adapter: { ...biome, cli: { ...biome.cli, packageManagers: ["npm", "npm"] } },
          exportName: "biome",
          stackDir: "biome",
        },
      ]),
    ).rejects.toThrow("repeats package manager: npm");
  });

  it("requires custom runner templates to exactly cover declared package managers", async () => {
    const biome = toolchains.find((toolchain) => toolchain.feature === "biome");
    if (biome?.cli == null) {
      throw new Error("Missing Biome CLI adapter");
    }
    const runner = {
      npm: ["npx", "@biomejs/biome@{version}", "init"],
    } as const;

    expect(
      defineToolchain({
        feature: "biome",
        label: "Biome",
        package: "@biomejs/biome",
        command: "init",
        runner,
      }).cli?.packageManagers,
    ).toEqual(["npm"]);
    await expect(
      validateDiscoveredToolchains([
        {
          adapter: {
            ...biome,
            cli: { ...biome.cli, packageManagers: ["npm", "pnpm"], runner },
          },
          exportName: "biome",
          stackDir: "biome",
        },
      ]),
    ).rejects.toThrow("no runner template for declared package manager: pnpm");
    await expect(
      validateDiscoveredToolchains([
        {
          adapter: {
            ...biome,
            cli: {
              ...biome.cli,
              packageManagers: ["npm"],
              runner: { ...runner, pnpm: ["pnpm", "dlx", "@biomejs/biome@{version}"] },
            },
          },
          exportName: "biome",
          stackDir: "biome",
        },
      ]),
    ).rejects.toThrow("undeclared runner template: pnpm");
    await expect(
      validateDiscoveredToolchains([
        {
          adapter: {
            ...biome,
            cli: { ...biome.cli, packageManagers: ["npm"], runner: { npm: [] } },
          },
          exportName: "biome",
          stackDir: "biome",
        },
      ]),
    ).rejects.toThrow("runner template needs a nonempty binary: npm");
  });

  it("finds and removes orphan generated manifests without touching handwritten wrappers", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-orphans-"));
    try {
      const expectedDir = path.join(tempDir, "expected");
      const orphanDir = path.join(tempDir, "orphan");
      const handwrittenDir = path.join(tempDir, "handwritten");
      await Promise.all([
        mkdir(expectedDir, { recursive: true }),
        mkdir(orphanDir, { recursive: true }),
        mkdir(handwrittenDir, { recursive: true }),
      ]);
      const expectedManifest = path.join(expectedDir, "manifest.generated.json");
      const expectedWrapper = path.join(expectedDir, "manifest.ts");
      const orphanManifest = path.join(orphanDir, "manifest.generated.json");
      const orphanWrapper = path.join(orphanDir, "manifest.ts");
      const handwrittenWrapper = path.join(handwrittenDir, "manifest.ts");
      await Promise.all([
        writeFile(expectedManifest, "{}\n"),
        writeFile(
          expectedWrapper,
          "// Generated by scripts/update-cli-manifests.ts. Do not edit directly.\n",
        ),
        writeFile(orphanManifest, "{}\n"),
        writeFile(
          orphanWrapper,
          "// Generated by scripts/update-cli-manifests.ts. Do not edit directly.\n",
        ),
        writeFile(handwrittenWrapper, "export const manifest = {};\n"),
      ]);

      const orphaned = await findOrphanGeneratedFiles([expectedManifest, expectedWrapper], tempDir);
      expect(orphaned).toEqual([orphanManifest, orphanWrapper].sort());

      await removeOrphanGeneratedFiles(orphaned);
      await expect(access(orphanManifest)).rejects.toThrow();
      await expect(access(orphanWrapper)).rejects.toThrow();
      await expect(readFile(handwrittenWrapper, "utf8")).resolves.toContain("manifest");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("keeps CLI identity declarations minimal in stack adapters", () => {
    const hotUpdater = defineToolchain({
      feature: "hotUpdater",
      label: "Hot Updater",
      package: "hot-updater",
      command: "init",
    });

    expect(hotUpdater.hint).toBe("");
    expect(hotUpdater.cli).toMatchObject({
      package: "hot-updater",
      command: "init",
    });
  });

  it("exports raw generated JSON manifests as package subpaths", () => {
    expect(packageJson.exports).toMatchObject({
      "./stacks/*/manifest.generated.json": "./dist/stacks/*/manifest.generated.json",
    });
  });

  it("appends Playwright arguments without interpreting them", () => {
    expect(
      resolveCliCommand(playwrightCliManifest, "init", "npm", [
        "--quiet",
        "--lang=Rust",
        "--no-browsers",
        "--future-flag",
      ]),
    ).toEqual({
      bin: "npm",
      args: [
        "init",
        `playwright@${playwrightCliManifest.version}`,
        "--",
        "--quiet",
        "--lang=Rust",
        "--no-browsers",
        "--future-flag",
      ],
    });
  });
});
