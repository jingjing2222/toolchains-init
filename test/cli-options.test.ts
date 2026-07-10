import { describe, expect, it } from "vitest";
import {
  getRequestedToolchainAdapters,
  parseCliOptions,
  renderHelp,
  validateNonInteractiveToolchains,
} from "../src/core/cli-options";

describe("CLI options", () => {
  it("parses a fully specified non-interactive plan", () => {
    const options = parseCliOptions([
      "--toolchains",
      "router,playwright,oxlint",
      "--package-manager",
      "pnpm",
      "--router",
      "file",
      "--yes",
    ]);

    expect(options).toMatchObject({
      packageManager: "pnpm",
      requestedToolchains: ["router", "playwright", "oxlint"],
      routerMode: "file",
      yes: true,
    });
  });

  it("supports all and deduplicates explicit IDs", () => {
    expect(parseCliOptions(["--toolchains", "all"]).requestedToolchains).toBe("all");
    expect(parseCliOptions(["--toolchains", "knip,react-doctor,knip"]).requestedToolchains).toEqual(
      ["knip", "react-doctor"],
    );
  });

  it("validates closed option values", () => {
    expect(() => parseCliOptions(["--package-manager", "pip"])).toThrow(
      "Expected one of: npm, pnpm, yarn, bun, deno",
    );
    expect(() => parseCliOptions(["--router", "pages"])).toThrow("Invalid router mode");
  });

  it("rejects duplicate singleton options", () => {
    expect(() => parseCliOptions(["--target", "apps/a", "--target", "apps/b"])).toThrow(
      "Duplicate option: --target",
    );
    expect(() => parseCliOptions(["--toolchains", "knip", "--toolchains", "biome"])).toThrow(
      "Duplicate option: --toolchains",
    );
  });

  it("lets informational flags bypass semantic option validation", () => {
    expect(parseCliOptions(["--package-manager", "pip", "--help"]).help).toBe(true);
    expect(parseCliOptions(["--toolchains", "unknown", "--version"]).version).toBe(true);
  });

  it("reports interactive-only toolchains for unattended runs", () => {
    const selected = getRequestedToolchainAdapters(["hot-updater", "eslint"]);
    const errors = validateNonInteractiveToolchains(selected, true);

    expect(errors.join("\n")).toContain("hot-updater");
    expect(errors.join("\n")).toContain("eslint");
  });

  it("renders registry-derived interactive capabilities in help", () => {
    const help = renderHelp("1.2.3");

    expect(help).toContain("provider setup requires project-specific interactive choices");
    expect(help).toContain("@eslint/create-config still prompts for dependency installation");
    expect(help).toContain("Yarn SDKs — Generates Yarn PnP editor SDKs for VSCode");
    expect(help).toContain("[package managers: yarn]");
  });
});
