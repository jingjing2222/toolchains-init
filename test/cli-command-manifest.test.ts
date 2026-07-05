import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../src/core/cli-command-manifest";
import { cliCommandManifestData, cliCommandManifests, getCliCommandManifest } from "../src/stacks";

const playwrightCliManifest = getCliCommandManifest("playwright");
if (playwrightCliManifest == null) {
  throw new Error("Missing Playwright CLI command manifest");
}

describe("CLI command manifests", () => {
  it("registers every CLI-backed toolchain command", () => {
    const expectedTools = [
      "tanstack-router",
      "playwright",
      "oxfmt",
      "oxlint",
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
        for (const packageManager of ["npm", "pnpm", "yarn"] as const) {
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
  });

  it("resolves pinned Playwright init commands by package manager", () => {
    expect(resolveCliCommand(playwrightCliManifest, "init", "npm")).toEqual({
      bin: "npm",
      args: ["init", "playwright@1.17.139", "--"],
    });
    expect(resolveCliCommand(playwrightCliManifest, "init", "pnpm")).toEqual({
      bin: "pnpm",
      args: ["create", "playwright@1.17.139"],
    });
    expect(resolveCliCommand(playwrightCliManifest, "init", "yarn")).toEqual({
      bin: "yarn",
      args: ["create", "playwright@1.17.139"],
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
        "playwright@1.17.139",
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
