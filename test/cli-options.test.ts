import { describe, expect, it } from "vitest";
import { parseCliOptions, renderHelp } from "../src/core/cli-options";
import { resolveManagedCliPlans } from "../src/core/managed-cli";
import { getSelectedToolchains } from "../src/stacks";

describe("CLI options", () => {
  it("parses direct selectors and generated namespaced flags", () => {
    const options = parseCliOptions([
      "--playwright",
      "--playwright.lang",
      "TypeScript",
      "--playwright.quiet",
      "--package-manager",
      "pnpm",
      "--yes",
    ]);

    expect(options).toMatchObject({
      managedCliFlags: {
        playwright: { lang: "TypeScript", quiet: true },
      },
      managedCliRawArgs: {},
      packageManager: "pnpm",
      selectedFeatures: ["playwright"],
      yes: true,
    });
  });

  it("preserves direct selector order for origin command execution", () => {
    const parsed = parseCliOptions(["--yarn-sdks", "--cspell"]);

    expect(parsed.selectedFeatures).toEqual(["yarnSdks", "cspell"]);
    expect(
      getSelectedToolchains(parsed.selectedFeatures ?? []).map((toolchain) => toolchain.feature),
    ).toEqual(["yarnSdks", "cspell"]);
  });

  it("parses repeatable raw arguments without interpreting their contents", () => {
    const options = parseCliOptions([
      "--prisma",
      "--prisma.raw.arg",
      "--preview-feature",
      "--prisma.raw.arg=one",
      "--prisma.raw.arg",
      "--",
      "--prisma.raw.arg=file.ts",
    ]);

    expect(options.managedCliRawArgs).toEqual({
      prisma: ["--preview-feature", "one", "--", "file.ts"],
    });
  });

  it("carries typed and raw arguments into the exact origin command plan", () => {
    const parsed = parseCliOptions([
      "--playwright",
      "--playwright.browser=chromium",
      "--playwright.help",
      "--playwright.raw.arg=--version",
      "--yes",
    ]);
    const selectedToolchains = getSelectedToolchains(parsed.selectedFeatures ?? []);
    const plan = resolveManagedCliPlans({
      packageManager: "npm",
      selectedToolchains,
      userFlags: parsed.managedCliFlags,
      userRawArgs: parsed.managedCliRawArgs,
    }).get("playwright");

    expect(plan?.command.args).toEqual(
      expect.arrayContaining(["--browser", "chromium", "--help", "--version"]),
    );
  });

  it("keeps wrapper --yes out of origin arguments", () => {
    const withoutYes = parseCliOptions(["--cspell"]);
    const withYes = parseCliOptions(["--cspell", "--yes"]);
    const selectedToolchains = getSelectedToolchains(["cspell"]);

    const resolve = (parsed: typeof withoutYes) =>
      resolveManagedCliPlans({
        packageManager: "npm",
        selectedToolchains,
        userFlags: parsed.managedCliFlags,
        userRawArgs: parsed.managedCliRawArgs,
      }).get("cspell")?.command;

    expect(resolve(withYes)).toEqual(resolve(withoutYes));
  });

  it("requires explicit selectors for wrapper --yes", () => {
    expect(() => parseCliOptions(["--toolchains", "all"])).toThrow(/unknown option/i);
    expect(() => parseCliOptions(["--router", "file"])).toThrow(/unknown option/i);
    expect(() => parseCliOptions(["--yes"])).toThrow("requires at least one direct");
  });

  it("validates wrapper and generated enum values", () => {
    expect(() => parseCliOptions(["--package-manager", "pip"])).toThrow(
      "Expected one of: npm, pnpm, yarn, bun, deno",
    );
    expect(() => parseCliOptions(["--playwright", "--playwright.lang=rust"])).toThrow(
      "Expected one of: js, TypeScript",
    );
  });

  it("rejects duplicate singleton options but accepts repeated raw args", () => {
    expect(() => parseCliOptions(["--target", "apps/a", "--target", "apps/b"])).toThrow(
      "Duplicate option: --target",
    );
    expect(() => parseCliOptions(["--playwright", "--playwright"])).toThrow(
      "Duplicate option: --playwright",
    );
    expect(() =>
      parseCliOptions(["--playwright", "--playwright.lang=js", "--playwright.lang=TypeScript"]),
    ).toThrow("Duplicate option: --playwright.lang");
    expect(
      parseCliOptions(["--playwright", "--playwright.raw.arg=first", "--playwright.raw.arg=second"])
        .managedCliRawArgs,
    ).toEqual({ playwright: ["first", "second"] });
  });

  it("requires the matching selector for typed and raw origin arguments", () => {
    expect(() => parseCliOptions(["--playwright.lang=js"])).toThrow(
      "requires the --playwright tool selector",
    );
    expect(() => parseCliOptions(["--playwright.raw.arg=file.ts"])).toThrow(
      "requires the --playwright tool selector",
    );
  });

  it("lets wrapper help and version bypass unrelated semantic validation", () => {
    expect(parseCliOptions(["--package-manager", "pip", "--help"]).help).toBe(true);
    expect(parseCliOptions(["--package-manager", "pip", "--version"]).version).toBe(true);
    expect(parseCliOptions(["--playwright", "--playwright.lang=rust", "--help"])).toMatchObject({
      help: true,
      helpTool: "playwright",
    });
  });

  it("renders transparent origin argument help without wrapper policy", () => {
    const help = renderHelp("1.2.3");
    const focused = renderHelp("1.2.3", "playwright");

    expect(help).toContain("--<tool>.raw.arg <value>");
    expect(help).not.toContain("interactive-only");
    expect(help).not.toContain("--no-install");
    expect(focused).toContain("--playwright.help");
    expect(focused).not.toContain("--playwright.version  forwards");
    expect(focused).toContain("--playwright.raw.arg=--version");
    expect(focused).toContain("--playwright.raw.arg");
    expect(focused).not.toContain("[blocked:");
    expect(focused).not.toContain("[locked");
  });
});
