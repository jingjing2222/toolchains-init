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

  it("derives manifest interaction contracts from the adapter exception", () => {
    for (const toolchain of toolchains.filter((candidate) => candidate.cli != null)) {
      const manifest = getCliCommandManifest(getToolchainCliTool(toolchain));
      expect(manifest?.commands[0]?.interactive).toBe(
        toolchain.nonInteractive?.supported === false,
      );
    }
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
      browser: { cliName: "--browser", type: "string" },
      noBrowsers: { cliName: "--no-browsers", type: "boolean" },
      lang: { cliName: "--lang", type: "enum", values: ["js", "TypeScript"] },
    });

    const tanStackCliManifest = getCliCommandManifest("tanstack-router");
    expect(tanStackCliManifest?.commands[0]?.flags).toMatchObject({
      deployment: {
        cliName: "--deployment",
        type: "enum",
        values: ["cloudflare", "netlify", "nitro", "railway"],
      },
      routerOnly: { cliName: "--router-only", type: "boolean" },
    });

    const storybookCliManifest = getCliCommandManifest("storybook");
    expect(storybookCliManifest?.commands[0]?.flags).toMatchObject({
      force: { cliName: "--force", type: "boolean" },
      skipInstall: { cliName: "--skip-install", type: "boolean" },
      yes: { cliName: "--yes", type: "boolean" },
    });
  });

  it("rejects ambiguous generated flag identities and invalid enum contracts", () => {
    const manifest = {
      commands: [
        {
          flags: {
            first: { cliName: "--same", supported: true, type: "boolean" },
            second: { cliName: "--same", supported: true, type: "string" },
          },
          id: "init",
          interactive: false,
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
    expect(() =>
      defineCliCommandManifest({
        ...manifest,
        commands: [
          {
            ...manifest.commands[0],
            flags: {
              mode: { cliName: "--mode", supported: true, type: "enum", values: [] },
            },
          },
        ],
      }),
    ).toThrow("Invalid enum values");
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
          reason: expect.stringContaining("Adapter appends"),
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
      npm: ["npx", "oxfmt@{version}"],
      pnpm: ["pnpm", "dlx", "oxfmt@{version}"],
      yarn: ["yarn", "dlx", "oxfmt@{version}"],
      bun: ["bunx", "oxfmt@{version}"],
      deno: ["deno", "x", "-A", "npm:oxfmt@{version}"],
    });
    expect(oxlintCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "oxlint@{version}"],
      pnpm: ["pnpm", "dlx", "oxlint@{version}"],
      yarn: ["yarn", "dlx", "oxlint@{version}"],
      bun: ["bunx", "oxlint@{version}"],
      deno: ["deno", "x", "-A", "npm:oxlint@{version}"],
    });
    expect(prettierCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "prettier@{version}"],
      pnpm: ["pnpm", "dlx", "prettier@{version}"],
      yarn: ["yarn", "dlx", "prettier@{version}"],
      bun: ["bunx", "prettier@{version}"],
      deno: ["deno", "x", "-A", "npm:prettier@{version}"],
    });
    expect(eslintCliManifest?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "@eslint/create-config@{version}"],
      pnpm: ["pnpm", "dlx", "@eslint/create-config@{version}"],
      yarn: ["yarn", "dlx", "@eslint/create-config@{version}"],
      bun: ["bunx", "@eslint/create-config@{version}"],
      deno: ["deno", "x", "-A", "npm:@eslint/create-config@{version}"],
    });
    expect(yarnSdksCliManifest?.commands[0]?.packageManagers).toEqual({
      yarn: ["yarn", "dlx", "@yarnpkg/sdks@{version}", "vscode"],
    });
    expect(yarnSdksCliManifest?.sources.map((source) => source.kind)).toEqual(["npm", "docs"]);
    expect(storybookCliManifest?.commands[0]?.packageManagers).toEqual({
      npm: ["npm", "init", "storybook@{version}", "--"],
      pnpm: ["pnpm", "create", "storybook@{version}"],
      yarn: ["yarn", "create", "storybook@{version}"],
      bun: ["bun", "create", "storybook@{version}"],
    });
  });

  it("keeps flag-only initializers free of positional init subcommands", () => {
    const oxfmtCliManifest = getCliCommandManifest("oxfmt");
    const oxlintCliManifest = getCliCommandManifest("oxlint");
    if (oxfmtCliManifest == null || oxlintCliManifest == null) {
      throw new Error("Missing Oxc CLI manifests");
    }

    expect(resolveCliCommand(oxfmtCliManifest, "init", "npm", { init: true })).toEqual({
      bin: "npx",
      args: [`oxfmt@${oxfmtCliManifest.version}`, "--init"],
    });
    expect(resolveCliCommand(oxlintCliManifest, "init", "npm", { init: true })).toEqual({
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
          interactive: false,
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
      npm: ["npm", "init", "@scope/widget@{version}", "--"],
      pnpm: ["pnpm", "create", "@scope/widget@{version}"],
      yarn: ["yarn", "create", "@scope/widget@{version}"],
      bun: ["bun", "create", "@scope/widget@{version}"],
      deno: ["deno", "x", "-A", "npm:@scope/create-widget@{version}"],
    });
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

  it("serializes manifest-backed Playwright quiet flags", () => {
    expect(
      resolveCliCommand(playwrightCliManifest, "init", "npm", {
        quiet: true,
        lang: "TypeScript",
        noBrowsers: true,
      }),
    ).toEqual({
      bin: "npm",
      args: [
        "init",
        `playwright@${playwrightCliManifest.version}`,
        "--",
        "--quiet",
        "--lang",
        "TypeScript",
        "--no-browsers",
      ],
    });
  });

  it("rejects flags not declared by the command contract", () => {
    expect(() =>
      resolveCliCommand(playwrightCliManifest, "init", "npm", {
        framework: "react",
      }),
    ).toThrow("Unsupported CLI flag");
  });
});
