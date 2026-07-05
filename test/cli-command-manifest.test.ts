import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../src/core/cli-command-manifest";
import { defineToolchain } from "../src/core/toolchain-adapter";
import { cliCommandManifestData, cliCommandManifests, getCliCommandManifest } from "../src/stacks";
import { resolvePackageManagerCommands, runHelpCommand } from "../scripts/update-cli-manifests";
import packageJson from "../package.json" with { type: "json" };

const playwrightCliManifest = getCliCommandManifest("playwright");
if (playwrightCliManifest == null) {
  throw new Error("Missing Playwright CLI command manifest");
}

describe("CLI command manifests", () => {
  it("registers every CLI-backed toolchain command", () => {
    const expectedTools = [
      "tanstack-router",
      "hot-updater",
      "playwright",
      "storybook",
      "oxfmt",
      "prettier",
      "oxlint",
      "eslint",
      "biome",
      "knip",
      "react-doctor",
      "changesets",
      "yarn-sdks",
    ];

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
    expect(yarnSdksCliManifest?.sources.map((source) => source.kind)).toEqual(["npm"]);
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
