import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defineCliCommandManifest, resolveCliCommand } from "../src/core/cli-command-manifest";
import { defineToolchain } from "../src/core/toolchain-adapter";
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

const retainedToolIds = [
  "hot-updater",
  "prisma",
  "shadcn",
  "supabase",
  "playwright",
  "storybook",
  "oxfmt",
  "oxlint",
  "eslint",
  "biome",
  "changesets",
  "cspell",
  "secretlint",
  "yarn-sdks",
] as const;

const playwrightCliManifest = getCliCommandManifest("playwright");
if (playwrightCliManifest == null) {
  throw new Error("Missing Playwright CLI command manifest");
}

describe("CLI command manifests", () => {
  it("registers exactly the retained initializer catalog", () => {
    expect(toolchains.map((toolchain) => toolchain.id)).toEqual(retainedToolIds);
    expect(cliCommandManifestData.map((manifest) => manifest.tool)).toEqual(retainedToolIds);
    expect(cliCommandManifests.map((manifest) => manifest.tool)).toEqual(retainedToolIds);
    expect(cliCommandManifests).toHaveLength(14);
  });

  it("resolves every command for its generated package-manager contract", () => {
    for (const manifest of cliCommandManifests) {
      for (const command of manifest.commands) {
        expect(command.id).not.toBe("check");
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

  it("derives focused-help flags from origin help output", () => {
    expect(playwrightCliManifest.commands[0]?.flags).toMatchObject({
      browser: { cliName: "--browser" },
      lang: { cliName: "--lang" },
      noBrowsers: { cliName: "--no-browsers" },
    });

    expect(getCliCommandManifest("storybook")?.commands[0]?.flags).toMatchObject({
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
  --format <format>          file format (choices: "yaml",
                             "yml", "json", "jsonc", default: "yaml")
  -t, --template <template>  template (next, start, vite,
                             react-router, laravel, astro)
  --secretlintignore [path:String] path to the ignore file
  --secretlintrcJSON [String] a JSON config string
  --ignore-rules <rules...>  rules to ignore
  --migrate=SOURCE           migrate from a specified source
  -c, --config=PATH          path to configuration
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
  --format <format>  file format (choices: "yaml",
                     "json", "jsonc", default: "yaml")
`).map((flag) => flag.cliName),
    ).toEqual(["--format"]);
  });

  it("rejects ambiguous generated flag identities", () => {
    expect(() =>
      defineCliCommandManifest({
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
      }),
    ).toThrow("Duplicate CLI flag name");
  });

  it("keeps docs-backed review metadata in every generated manifest", () => {
    for (const manifest of cliCommandManifests) {
      expect(
        manifest.sources.some((source) => source.kind === "docs" && source.review != null),
        manifest.tool,
      ).toBe(true);
    }

    expect(getCliCommandManifest("hot-updater")?.sources).toContainEqual(
      expect.objectContaining({
        kind: "docs",
        url: "https://hot-updater.dev/docs/get-started/basic-usage",
        review: expect.objectContaining({
          files: ["src/stacks/hot-updater/adapter.ts", "src/stacks/hot-updater/init.test.ts"],
          reason: expect.stringContaining("hot-updater init command unchanged"),
        }),
      }),
    );
  });

  it("resolves pinned Playwright initializer commands by package manager", () => {
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

  it("generates init command identities and the Yarn-only SDK command", () => {
    expect(getCliCommandManifest("biome")?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "@biomejs/biome@{version}", "init"],
      pnpm: ["pnpm", "dlx", "@biomejs/biome@{version}", "init"],
      yarn: ["yarn", "dlx", "@biomejs/biome@{version}", "init"],
      bun: ["bunx", "@biomejs/biome@{version}", "init"],
      deno: ["deno", "x", "-A", "npm:@biomejs/biome@{version}", "init"],
    });
    expect(getCliCommandManifest("oxfmt")?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "oxfmt@{version}", "--init"],
      pnpm: ["pnpm", "dlx", "oxfmt@{version}", "--init"],
    });
    expect(getCliCommandManifest("oxlint")?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "oxlint@{version}", "--init"],
      pnpm: ["pnpm", "dlx", "oxlint@{version}", "--init"],
    });
    expect(getCliCommandManifest("eslint")?.commands[0]?.packageManagers).toMatchObject({
      npm: ["npx", "@eslint/create-config@{version}"],
      pnpm: ["pnpm", "dlx", "@eslint/create-config@{version}"],
    });
    expect(getCliCommandManifest("storybook")?.commands[0]?.packageManagers).toEqual({
      npm: ["npm", "init", "storybook@{version}", "--"],
      pnpm: ["pnpm", "create", "storybook@{version}"],
      yarn: ["yarn", "create", "storybook@{version}"],
      bun: ["bun", "create", "storybook@{version}"],
      deno: ["deno", "x", "-A", "npm:create-storybook@{version}"],
    });

    const yarnSdksManifest = getCliCommandManifest("yarn-sdks");
    expect(yarnSdksManifest?.commands[0]?.packageManagers).toEqual({
      yarn: ["yarn", "dlx", "@yarnpkg/sdks@{version}", "vscode"],
    });
    expect(yarnSdksManifest?.sources.map((source) => source.kind)).toEqual(["npm", "docs"]);
  });

  it("keeps flag-only initializers in the generated command identity", () => {
    const oxfmtManifest = getCliCommandManifest("oxfmt");
    const oxlintManifest = getCliCommandManifest("oxlint");
    if (oxfmtManifest == null || oxlintManifest == null) {
      throw new Error("Missing Oxc CLI manifests");
    }

    expect(resolveCliCommand(oxfmtManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`oxfmt@${oxfmtManifest.version}`, "--init"],
    });
    expect(resolveCliCommand(oxlintManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`oxlint@${oxlintManifest.version}`, "--init"],
    });
  });

  it("preserves package scopes and explicit subcommands in inferred create commands", () => {
    expect(
      resolvePackageManagerCommands(
        {
          commandArgs: ["--template", "react"],
          commandId: "init",
          distTag: "latest",
          docs: [],
          exportName: "scopedCreateCliManifest",
          help: undefined,
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
      npm: ["npm", "init", "@scope/widget@{version}", "--", "init", "--template", "react"],
      pnpm: ["pnpm", "create", "@scope/widget@{version}", "init", "--template", "react"],
      yarn: ["yarn", "create", "@scope/widget@{version}", "init", "--template", "react"],
      bun: ["bun", "create", "@scope/widget@{version}", "init", "--template", "react"],
      deno: [
        "deno",
        "x",
        "-A",
        "npm:@scope/create-widget@{version}",
        "init",
        "--template",
        "react",
      ],
    });
  });

  it("appends static initializer identity to custom runner templates", () => {
    expect(
      resolvePackageManagerCommands(
        {
          commandArgs: ["--init"],
          commandId: "init",
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
    ).toEqual({ npm: ["npx", "example@{version}", "--init"] });
  });

  it("keeps plausible help output from CLIs that exit nonzero", async () => {
    await expect(
      runHelpCommand([
        process.execPath,
        "-e",
        "console.log('--flag  useful help'); process.exit(2)",
      ]),
    ).resolves.toContain("--flag  useful help");
  });

  it("rejects non-help output and bounds stalled help probes", async () => {
    await expect(
      runHelpCommand([
        process.execPath,
        "-e",
        "console.error('configuration is invalid'); process.exit(2)",
      ]),
    ).rejects.toThrow();
    await expect(
      runHelpCommand([process.execPath, "-e", "setTimeout(() => {}, 10_000)"], 50),
    ).rejects.toThrow();
  });

  it("rejects duplicate ids and adapter export names before external probes", async () => {
    const biome = getToolchain("biome");
    const eslint = getToolchain("eslint");

    await expect(
      validateDiscoveredToolchains([
        discovered(biome),
        discovered({ ...eslint, id: biome.id }, "eslint", biome.id),
      ]),
    ).rejects.toThrow("Duplicate toolchain id: biome");
    await expect(
      validateDiscoveredToolchains([discovered(biome), discovered(eslint, "biome", "eslint")]),
    ).rejects.toThrow("Duplicate adapter export name: biome");
  });

  it("requires ids, directories, exports, capabilities, and selectors to agree", async () => {
    const biome = getToolchain("biome");

    await expect(
      validateDiscoveredToolchains([discovered(biome, "biome", "other")]),
    ).rejects.toThrow("must use the matching stack directory: biome");
    await expect(
      validateDiscoveredToolchains([discovered(biome, "other", "biome")]),
    ).rejects.toThrow("must export biome, received other");
    await expect(
      validateDiscoveredToolchains([discovered({ ...biome, id: "Biome" }, "biome", "Biome")]),
    ).rejects.toThrow("must use lowercase kebab-case");
    await expect(
      validateDiscoveredToolchains([discovered({ ...biome, id: "plan" }, "plan", "plan")]),
    ).rejects.toThrow("Direct CLI selector is reserved: plan");
    await expect(
      validateDiscoveredToolchains([discovered({ ...biome, capabilities: [] }, "biome", "biome")]),
    ).rejects.toThrow("must declare at least one capability");
  });

  it("requires complete docs review metadata and existing review files", async () => {
    const biome = getToolchain("biome");
    const missingFile = {
      ...biome,
      origin: {
        ...biome.origin,
        docs: [
          {
            confidence: "high" as const,
            url: "https://example.com/docs",
            review: {
              reason: "Review the initializer contract.",
              files: ["test/does-not-exist.ts"],
              mustContain: ["init"],
              checks: ["Confirm init remains supported."],
            },
          },
        ],
      },
    };
    await expect(validateDiscoveredToolchains([discovered(missingFile)])).rejects.toThrow(
      "references a missing review file",
    );

    const incomplete = {
      ...missingFile,
      origin: {
        ...missingFile.origin,
        docs: [
          {
            confidence: "high" as const,
            url: "https://example.com/docs",
            review: {
              reason: "Review the initializer contract.",
              files: ["test/cli-command-manifest.test.ts"],
              mustContain: ["init"],
              checks: [],
            },
          },
        ],
      },
    };
    await expect(validateDiscoveredToolchains([discovered(incomplete)])).rejects.toThrow(
      "review.checks must contain at least one nonempty value",
    );
  });

  it("requires custom runner templates to exactly cover package managers", async () => {
    const biome = getToolchain("biome");
    const runner = { npm: ["npx", "@biomejs/biome@{version}", "init"] } as const;
    const custom = defineToolchain({ ...biome, origin: { ...biome.origin, runner } });
    expect(custom.origin.packageManagers).toEqual(["npm"]);

    await expect(
      validateDiscoveredToolchains([
        discovered({
          ...custom,
          origin: { ...custom.origin, packageManagers: ["npm", "pnpm"] },
        }),
      ]),
    ).rejects.toThrow("no runner template for declared package manager: pnpm");
    await expect(
      validateDiscoveredToolchains([
        discovered({
          ...custom,
          origin: {
            ...custom.origin,
            packageManagers: ["npm"],
            runner: { ...runner, pnpm: ["pnpm", "dlx", "@biomejs/biome@{version}"] },
          },
        }),
      ]),
    ).rejects.toThrow("undeclared runner template: pnpm");
    await expect(
      validateDiscoveredToolchains([
        discovered({
          ...custom,
          origin: { ...custom.origin, packageManagers: ["npm"], runner: { npm: [] } },
        }),
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

  it("keeps catalog metadata separate from origin command identity", () => {
    const example = defineToolchain({
      id: "example",
      label: "Example",
      summary: "Example initializer",
      area: "app",
      capabilities: ["database-orm"],
      order: 10,
      origin: {
        package: "create-example",
        command: "init",
        docs: [],
      },
    });

    expect(example).toMatchObject({
      id: "example",
      summary: "Example initializer",
      origin: { package: "create-example", command: "init" },
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

function getToolchain(id: string) {
  const toolchain = toolchains.find((candidate) => candidate.id === id);
  if (toolchain == null) {
    throw new Error(`Missing test toolchain: ${id}`);
  }
  return toolchain;
}

function discovered(
  adapter: (typeof toolchains)[number],
  exportName = adapter.id.replace(/-([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  ),
  stackDir = adapter.id,
) {
  return { adapter, exportName, stackDir };
}
