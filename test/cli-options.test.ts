import { describe, expect, it } from "vitest";
import {
  parseCliOptions,
  renderHelp,
  validateNonInteractiveToolchains,
} from "../src/core/cli-options";
import { resolveManagedCliPlans } from "../src/core/managed-cli";
import { DEFAULT_ROUTER_MODE } from "../src/core/types";
import { getSelectedToolchains } from "../src/stacks/index";

describe("CLI options", () => {
  it("parses a fully specified non-interactive plan", () => {
    const options = parseCliOptions([
      "--tanstack-router",
      "--playwright",
      "--oxlint",
      "--package-manager",
      "pnpm",
      "--tanstack-router.setup.router-mode=file",
      "--yes",
    ]);

    expect(options).toMatchObject({
      packageManager: "pnpm",
      toolchainOptions: { routerMode: "file" },
      selectedFeatures: ["router", "playwright", "oxlint"],
      yes: true,
    });
  });

  it("parses direct selectors and manifest-generated namespaced flags", () => {
    const options = parseCliOptions([
      "--tanstack-router",
      "--tanstack-router.setup.router-mode=file",
      "--playwright",
      "--playwright.lang",
      "TypeScript",
      "--playwright.quiet",
      "--yes",
    ]);

    expect(options).toMatchObject({
      managedCliFlags: {
        playwright: { lang: "TypeScript", quiet: true },
      },
      toolchainOptions: { routerMode: "file" },
      selectedFeatures: ["router", "playwright"],
      yes: true,
    });
  });

  it("carries parsed generated flags into the real adapter command plan", () => {
    const parsed = parseCliOptions([
      "--playwright",
      "--playwright.browser=chromium",
      "--playwright.lang=js",
      "--yes",
    ]);
    const selectedToolchains = getSelectedToolchains(parsed.selectedFeatures ?? []);
    const plans = resolveManagedCliPlans({
      options: {
        features: selectedToolchains.map((toolchain) => toolchain.feature),
        routerMode: parsed.toolchainOptions.routerMode ?? DEFAULT_ROUTER_MODE,
      },
      packageManager: "npm",
      selectedToolchains,
      userFlags: parsed.managedCliFlags,
      yes: parsed.yes,
    });

    expect(plans.get("playwright")?.command.args).toEqual(
      expect.arrayContaining(["--browser", "chromium", "--lang", "js"]),
    );
  });

  it("removes legacy selectors and requires explicit groups for --yes", () => {
    expect(() => parseCliOptions(["--toolchains", "all"])).toThrow(/unknown option/i);
    expect(() => parseCliOptions(["--router", "file"])).toThrow(/unknown option/i);
    expect(() => parseCliOptions(["--yes"])).toThrow("requires at least one direct");
  });

  it("validates closed option values", () => {
    expect(() => parseCliOptions(["--package-manager", "pip"])).toThrow(
      "Expected one of: npm, pnpm, yarn, bun, deno",
    );
    expect(() =>
      parseCliOptions(["--tanstack-router", "--tanstack-router.setup.router-mode=pages"]),
    ).toThrow("Expected one of: file, code");
  });

  it("rejects duplicate singleton options", () => {
    expect(() => parseCliOptions(["--target", "apps/a", "--target", "apps/b"])).toThrow(
      "Duplicate option: --target",
    );
    expect(() => parseCliOptions(["--playwright", "--playwright"])).toThrow(
      "Duplicate option: --playwright",
    );
    expect(() =>
      parseCliOptions(["--playwright", "--playwright.lang=js", "--playwright.lang=TypeScript"]),
    ).toThrow("Duplicate option: --playwright.lang");
  });

  it("rejects ambiguous, unselected, invalid, or unused managed arguments", () => {
    expect(() => parseCliOptions(["--playwright.lang=js"])).toThrow(
      "requires the --playwright tool selector",
    );
    expect(() => parseCliOptions(["--tanstack-router.setup.router-mode=file"])).toThrow(
      "requires the --tanstack-router tool selector",
    );
    expect(() => parseCliOptions(["--playwright", "--playwright.lang=rust"])).toThrow(
      "Expected one of: js, TypeScript",
    );
    expect(() => parseCliOptions(["--playwright", "--playwright.lang=js", "--no-install"])).toThrow(
      "cannot be combined with --no-install",
    );
  });

  it("lets informational flags bypass semantic option validation", () => {
    expect(parseCliOptions(["--package-manager", "pip", "--help"]).help).toBe(true);
    expect(parseCliOptions(["--package-manager", "pip", "--version"]).version).toBe(true);
    expect(parseCliOptions(["--playwright", "--playwright.lang=rust", "--help"])).toMatchObject({
      help: true,
      helpTool: "playwright",
    });
  });

  it("reports interactive-only toolchains for unattended runs", () => {
    const selected = getSelectedToolchains(["hotUpdater", "eslint"]);
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
    expect(help).toContain("--tanstack-router");
    expect(help).toContain("--playwright --help");
  });

  it("renders focused manifest-derived flag help", () => {
    const help = renderHelp("1.2.3", "playwright");

    expect(help).toContain("Tool: --playwright");
    expect(help).toContain("--playwright.browser <value>");
    expect(help).toContain("--playwright.lang <js|TypeScript>");
    expect(help).toContain("--playwright.help");
    expect(help).toContain("[blocked:");
  });

  it("renders adapter-owned setup separately from generated flags", () => {
    const help = renderHelp("1.2.3", "tanstack-router");

    expect(help).toContain("Tool setup options:");
    expect(help).toContain("--tanstack-router.setup.router-mode <file|code>");
    expect(help).toContain("Generated upstream flags:");
    expect(help).toContain("--tanstack-router.router-only");
  });
});
