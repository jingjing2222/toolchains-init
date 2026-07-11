import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toolchainAreaLabels, toolchainCapabilities } from "../src/core/toolchain-catalog";
import type { ToolchainCapability } from "../src/core/toolchain-catalog";
import {
  ALL_TOOL_IDS,
  cliCommandManifests,
  getCliCommandManifest,
  getSelectedToolchains,
  toolchains,
} from "../src/stacks";

const expectedToolIds = [
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
  "cspell",
  "secretlint",
  "changesets",
  "yarn-sdks",
] as const;

const expectedCapabilities = {
  "hot-updater": ["mobile-ota"],
  prisma: ["database-orm"],
  shadcn: ["ui-components"],
  supabase: ["local-backend"],
  playwright: ["e2e-testing"],
  storybook: ["component-workshop"],
  oxfmt: ["formatting"],
  oxlint: ["linting"],
  eslint: ["linting"],
  biome: ["formatting", "linting"],
  cspell: ["spell-checking"],
  secretlint: ["secret-scanning"],
  changesets: ["versioning"],
  "yarn-sdks": ["editor-sdks"],
} satisfies Record<(typeof expectedToolIds)[number], readonly ToolchainCapability[]>;

describe("toolchain registry", () => {
  it("contains exactly the 14 admitted initializer IDs", () => {
    const expected = [...expectedToolIds].sort();

    expect(toolchains.map((toolchain) => toolchain.id).sort()).toEqual(expected);
    expect([...ALL_TOOL_IDS].sort()).toEqual(expected);
    expect(cliCommandManifests.map((manifest) => manifest.tool).sort()).toEqual(expected);
    expect(new Set(ALL_TOOL_IDS).size).toBe(14);
  });

  it("uses one canonical kebab-case ID for definitions, manifests, selectors, and paths", () => {
    for (const toolchain of toolchains) {
      expect(toolchain.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(getCliCommandManifest(toolchain.id)?.tool).toBe(toolchain.id);
      expect(
        existsSync(path.resolve("src", "stacks", toolchain.id, "adapter.ts")),
        toolchain.id,
      ).toBe(true);
      expect(
        existsSync(path.resolve("src", "stacks", toolchain.id, "manifest.generated.json")),
        toolchain.id,
      ).toBe(true);
    }
  });

  it("keeps exact curation capabilities and valid areas on every initializer", () => {
    for (const toolchain of toolchains) {
      expect(toolchain.capabilities, toolchain.id).toEqual(
        expectedCapabilities[toolchain.id as keyof typeof expectedCapabilities],
      );
      expect(toolchain.area, toolchain.id).toBeOneOf(Object.keys(toolchainAreaLabels));
      for (const capability of toolchain.capabilities) {
        expect(toolchainCapabilities, `${toolchain.id}/${capability}`).toHaveProperty(capability);
      }
    }
  });

  it("keeps origin ownership and only declares real package-manager restrictions", () => {
    for (const toolchain of toolchains) {
      expect(toolchain.origin.package.length, toolchain.id).toBeGreaterThan(0);
      expect(toolchain.origin.command.length, toolchain.id).toBeGreaterThan(0);
      expect(toolchain.origin.docs.length, toolchain.id).toBeGreaterThan(0);
      expect(toolchain).not.toHaveProperty("afterInstall");
      expect(toolchain).not.toHaveProperty("afterWrite");
      expect(toolchain).not.toHaveProperty("beforeRun");
      expect(toolchain).not.toHaveProperty("defaults");
      expect(toolchain).not.toHaveProperty("execute");
      expect(toolchain).not.toHaveProperty("managedCli");
      expect(toolchain).not.toHaveProperty("updatePackageJson");

      if (toolchain.id === "yarn-sdks") {
        expect(toolchain.origin.packageManagers).toEqual(["yarn"]);
      } else {
        expect(toolchain.origin.packageManagers, toolchain.id).toBeUndefined();
      }
    }
  });

  it("returns selected tools in canonical catalog order", () => {
    expect(
      getSelectedToolchains(["yarn-sdks", "cspell", "hot-updater"]).map(
        (toolchain) => toolchain.id,
      ),
    ).toEqual(["hot-updater", "cspell", "yarn-sdks"]);
  });
});
