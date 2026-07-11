import { describe, expect, it } from "vitest";
import { defineCliCommandManifest } from "../src/core/cli-command-manifest";
import type { CliCommandManifest, CliFlagContract } from "../src/core/cli-command-manifest";
import { createToolchainCliSurface } from "../src/core/cli-surface";
import { buildExecutionPlan, renderExecutionPlan } from "../src/core/execution-plan";
import { defineToolchain } from "../src/core/toolchain-adapter";
import type { ToolchainDefinition } from "../src/core/toolchain-adapter";
import type { ToolchainCapability } from "../src/core/toolchain-catalog";

const defaultFlags = {
  cwd: { cliName: "--cwd" },
  help: { cliName: "--help" },
  mode: { cliName: "--mode" },
  stdout: { cliName: "--stdout" },
  version: { cliName: "--version" },
} satisfies Record<string, CliFlagContract>;

function createManifest(
  tool = "widget",
  flags: Record<string, CliFlagContract> = defaultFlags,
  sources: CliCommandManifest["sources"] = [
    {
      kind: "docs",
      url: `https://example.com/${tool}`,
      confidence: "high",
    },
  ],
): CliCommandManifest {
  return defineCliCommandManifest({
    commands: [
      {
        flags,
        id: "init",
        packageManagers: {
          npm: ["npx", `create-${tool}@{version}`, "init"],
          pnpm: ["pnpm", "dlx", `create-${tool}@{version}`, "init"],
        },
      },
    ],
    package: `create-${tool}`,
    schemaVersion: "toolchains-init/cli-command-manifest/v1",
    sources,
    tool,
    version: "1.2.3",
  });
}

function createToolchain({
  capabilities = ["linting"],
  id = "widget",
  label = "Widget",
  order = 40,
}: {
  capabilities?: readonly ToolchainCapability[];
  id?: string;
  label?: string;
  order?: number;
} = {}): ToolchainDefinition {
  return defineToolchain({
    area: "quality",
    capabilities,
    id,
    label,
    order,
    origin: {
      command: "init",
      docs: [{ confidence: "high", url: `https://example.com/${id}` }],
      package: `create-${id}`,
    },
    summary: `Initialize ${label}`,
  });
}

function buildWidgetPlan(userArgs: readonly string[] = []) {
  return buildExecutionPlan({
    cwd: "/repo/apps/web",
    manifests: [createManifest()],
    packageManager: "npm",
    selectedToolchains: [createToolchain()],
    userArgs: { widget: userArgs },
  });
}

describe("toolchain CLI surface", () => {
  it("derives discovered flag names and a collision-proof raw argument option", () => {
    const surface = createToolchainCliSurface([createToolchain()], [createManifest()]);
    const group = surface.bySelector.get("widget");

    expect(group?.flags.map((flag) => flag.optionName)).toEqual([
      "widget.cwd",
      "widget.help",
      "widget.mode",
      "widget.stdout",
      "widget.version",
    ]);
    expect(group?.rawArgOptionName).toBe("widget.raw.arg");
  });

  it("uses the canonical tool ID for adapter, manifest, and selector identity", () => {
    const surface = createToolchainCliSurface([createToolchain()], [createManifest()]);
    const group = surface.groups[0];

    expect(group?.toolchain.id).toBe("widget");
    expect(group?.manifest.tool).toBe("widget");
    expect(group?.selector).toBe("widget");
  });

  it("rejects duplicate, reserved, missing, and mismatched identities", () => {
    expect(() =>
      createToolchainCliSurface(
        [createToolchain(), createToolchain({ label: "Other widget" })],
        [createManifest()],
      ),
    ).toThrow("Duplicate direct CLI selector: widget");
    expect(() =>
      createToolchainCliSurface([createToolchain({ id: "help" })], [createManifest("help")]),
    ).toThrow("Direct CLI selector is reserved: help");
    expect(() => createToolchainCliSurface([createToolchain()], [])).toThrow(
      "CLI adapter widget has no generated manifest",
    );
    expect(() =>
      createToolchainCliSurface([createToolchain()], [createManifest("different")]),
    ).toThrow("CLI adapter widget has no generated manifest");
    expect(() =>
      createToolchainCliSurface([createToolchain()], [createManifest(), createManifest()]),
    ).toThrow("Duplicate CLI manifest selector: widget");
  });
});

describe("catalog-ordered execution plan", () => {
  it("resolves package provenance and the exact structured origin command", () => {
    const plan = buildWidgetPlan();

    expect(plan).toEqual({
      cwd: "/repo/apps/web",
      notices: [],
      packageManager: "npm",
      steps: [
        {
          command: {
            args: ["create-widget@1.2.3", "init"],
            bin: "npx",
          },
          id: "widget",
          label: "Widget",
          packageName: "create-widget",
          packageVersion: "1.2.3",
          source: "https://example.com/widget",
        },
      ],
    });
  });

  it("forwards opaque, repeated, positional, and terminator tokens in order", () => {
    const args = [
      "--cwd=../elsewhere",
      "--mode",
      "unknown",
      "--preview-feature",
      "one",
      "--preview-feature",
      "two",
      "--",
      "file.ts",
    ];

    expect(buildWidgetPlan(args).steps[0]?.command.args).toEqual([
      "create-widget@1.2.3",
      "init",
      ...args,
    ]);
  });

  it("uses catalog order and reports overlapping singleton capabilities", () => {
    const biome = createToolchain({
      capabilities: ["formatting", "linting"],
      id: "biome",
      label: "Biome",
      order: 50,
    });
    const oxfmt = createToolchain({
      capabilities: ["formatting"],
      id: "oxfmt",
      label: "oxfmt",
      order: 30,
    });
    const plan = buildExecutionPlan({
      cwd: "/repo",
      manifests: [createManifest("biome"), createManifest("oxfmt")],
      packageManager: "npm",
      selectedToolchains: [biome, oxfmt],
    });

    expect(plan.steps.map((step) => step.id)).toEqual(["oxfmt", "biome"]);
    expect(plan.notices).toEqual([
      {
        code: "overlapping-capability",
        message: "oxfmt, Biome provide overlapping formatting setup.",
        toolIds: ["oxfmt", "biome"],
      },
    ]);
  });

  it("renders the same command tokens, provenance, warnings, and rollback boundary", () => {
    const biome = createToolchain({ capabilities: ["formatting"], id: "biome", label: "Biome" });
    const oxfmt = createToolchain({ capabilities: ["formatting"], id: "oxfmt", label: "oxfmt" });
    const plan = buildExecutionPlan({
      cwd: "/repo",
      manifests: [createManifest("biome"), createManifest("oxfmt")],
      packageManager: "pnpm",
      selectedToolchains: [biome, oxfmt],
      userArgs: { biome: ["--verbose"] },
    });
    const rendered = renderExecutionPlan(plan);

    expect(rendered).toContain("Target: /repo");
    expect(rendered).toContain("Package manager: pnpm");
    expect(rendered).toContain('Args: ["dlx","create-biome@1.2.3","init","--verbose"]');
    expect(rendered).toContain("Source: https://example.com/biome");
    expect(rendered).toContain("Biome, oxfmt provide overlapping formatting setup.");
    expect(rendered).toContain("stop on the first failure");
    expect(rendered).toContain("not rolled back");
  });

  it("rejects argument groups for unselected tools and incomplete provenance", () => {
    expect(() =>
      buildExecutionPlan({
        cwd: "/repo",
        manifests: [createManifest()],
        packageManager: "npm",
        selectedToolchains: [createToolchain()],
        userArgs: { other: ["--help"] },
      }),
    ).toThrow("unselected toolchain: other");
    expect(() =>
      buildExecutionPlan({
        cwd: "/repo",
        manifests: [createManifest("widget", defaultFlags, [])],
        packageManager: "npm",
        selectedToolchains: [createToolchain()],
      }),
    ).toThrow("CLI adapter widget has no documentation source");
  });
});
