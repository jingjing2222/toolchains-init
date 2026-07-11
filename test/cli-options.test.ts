import { describe, expect, it } from "vitest";
import { parseCliOptions, renderHelp } from "../src/core/cli-options";
import { buildExecutionPlan } from "../src/core/execution-plan";
import { getSelectedToolchains } from "../src/stacks";

describe("CLI options", () => {
  it("parses direct selectors, origin arguments, and wrapper planning options", () => {
    const options = parseCliOptions([
      "--playwright",
      "--playwright.lang",
      "TypeScript",
      "--playwright.quiet",
      "--package-manager",
      "pnpm",
      "--plan",
    ]);

    expect(options).toMatchObject({
      originArgs: { playwright: ["--lang", "TypeScript", "--quiet"] },
      packageManager: "pnpm",
      plan: true,
      selectedToolIds: ["playwright"],
    });
  });

  it("parses selector order but resolves execution in canonical catalog order", () => {
    const parsed = parseCliOptions(["--yarn-sdks", "--cspell", "--playwright"]);

    expect(parsed.selectedToolIds).toEqual(["yarn-sdks", "cspell", "playwright"]);
    expect(
      getSelectedToolchains(parsed.selectedToolIds ?? []).map((toolchain) => toolchain.id),
    ).toEqual(["playwright", "cspell", "yarn-sdks"]);
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

    expect(options.originArgs).toEqual({
      prisma: ["--preview-feature", "one", "--", "file.ts"],
    });
  });

  it("carries namespaced and raw arguments into the exact origin command plan", () => {
    const parsed = parseCliOptions([
      "--playwright",
      "--playwright.browser=chromium",
      "--playwright.help",
      "--playwright.raw.arg=--version",
    ]);
    const plan = buildExecutionPlan({
      cwd: "/repo",
      packageManager: "npm",
      selectedToolchains: getSelectedToolchains(parsed.selectedToolIds ?? []),
      userArgs: parsed.originArgs,
    });

    expect(plan.steps[0]?.command.args.slice(-3)).toEqual([
      "--browser=chromium",
      "--help",
      "--version",
    ]);
  });

  it("accepts plan-only selection while removing the former wrapper --yes contract", () => {
    expect(parseCliOptions(["--plan"])).toMatchObject({
      plan: true,
      selectedToolIds: null,
    });
    expect(() => parseCliOptions(["--yes"])).toThrow(/yes/i);
  });

  it("validates wrapper values but leaves origin values to the origin CLI", () => {
    expect(() => parseCliOptions(["--package-manager", "pip"])).toThrow(
      "Expected one of: npm, pnpm, yarn, bun, deno",
    );
    expect(parseCliOptions(["--playwright", "--playwright.lang=rust"]).originArgs).toEqual({
      playwright: ["--lang=rust"],
    });
  });

  it("rejects duplicate wrapper options but preserves repeated origin flags", () => {
    expect(() => parseCliOptions(["--target", "apps/a", "--target", "apps/b"])).toThrow(
      "Duplicate option: --target",
    );
    expect(() => parseCliOptions(["--playwright", "--playwright"])).toThrow(
      "Duplicate option: --playwright",
    );
    expect(
      parseCliOptions([
        "--playwright",
        "--playwright.lang=js",
        "--playwright.lang=TypeScript",
        "--playwright.raw.arg=first",
        "--playwright.raw.arg=second",
      ]).originArgs,
    ).toEqual({ playwright: ["--lang=js", "--lang=TypeScript", "first", "second"] });
  });

  it("accepts unknown origin flags but requires the matching selector", () => {
    expect(
      parseCliOptions(["--playwright", "--playwright.future_flag:anything=opaque"]).originArgs,
    ).toEqual({ playwright: ["--future_flag:anything=opaque"] });
    expect(() => parseCliOptions(["--playwright.lang=js"])).toThrow(
      "require the --playwright tool selector",
    );
    expect(() => parseCliOptions(["--playwright.raw.arg=file.ts"])).toThrow(
      "require the --playwright tool selector",
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

  it("renders planning and transparent origin-argument help without wrapper policy", () => {
    const help = renderHelp("1.2.3");
    const focused = renderHelp("1.2.3", "playwright");

    expect(help).toContain("--plan");
    expect(help).toContain("--<tool>.raw.arg <value>");
    expect(help).not.toContain("--yes");
    expect(help).not.toContain("--prettier");
    expect(focused).toContain("--playwright.help");
    expect(focused).toContain("--playwright.raw.arg=--version");
    expect(focused).toContain("does not validate names, values, or repetitions");
    expect(focused).not.toContain("Enum values");
    expect(focused).not.toContain("Boolean flags");
  });
});
