import { describe, expect, it } from "vitest";
import {
  parseNewToolchainArgs,
  renderAdapter,
  renderInitTest,
  renderNewToolchainHelp,
  resolveSubcommand,
} from "../scripts/new-toolchain";

describe("new toolchain scaffolding", () => {
  it("renders the canonical catalog and origin model", () => {
    const source = renderAdapter(
      scaffoldOptions({ commandArgs: ["--init"], commandId: "setup", subcommand: null }),
    );

    expect(source).toContain("export const hotUpdater = defineToolchain({");
    expect(source).toContain('id: "hot-updater"');
    expect(source).toContain('label: "Hot Updater"');
    expect(source).toContain('summary: "Runs the official Hot Updater initializer"');
    expect(source).toContain('area: "app"');
    expect(source).toContain('capabilities: ["mobile-ota"]');
    expect(source).toContain("order: 15");
    expect(source).toContain("origin: {");
    expect(source).toContain('package: "hot-updater"');
    expect(source).toContain('command: "init"');
    expect(source).toContain('commandArgs: ["--init"]');
    expect(source).toContain('commandId: "setup"');
    expect(source).toContain("subcommand: null");
    expect(source).toContain('mustContain":["hot-updater init"]');
    expect(source).toContain("src/stacks/hot-updater/adapter.ts");
    expect(source).not.toContain("feature:");
    expect(source).not.toContain("managedCli");
    expect(source).not.toContain("stackDir");
    expect(source).not.toContain("tool:");
    expect(source).not.toContain("exportName");
  });

  it("derives every public identity from the canonical kebab-case id", () => {
    const source = renderInitTest(scaffoldOptions());

    expect(source).toContain('import { hotUpdater } from "./adapter"');
    expect(source).toContain('import { hotUpdaterCliManifest } from "./manifest"');
    expect(source).toContain('id: "hot-updater"');
    expect(source).toContain('"--hot-updater"');
    expect(source).toContain('"--hot-updater.scaffold-test-flag=value"');
    expect(source).toContain('"--hot-updater.raw.arg=./scaffold-test-target"');
  });

  it("renders a plan-first exact origin-command execution test", () => {
    const source = renderInitTest(scaffoldOptions());

    expect(source).toContain('vi.mock("../../core/run-command"');
    expect(source).toContain('import { parseCliOptions } from "../../core/cli-options"');
    expect(source).toContain('import { buildExecutionPlan } from "../../core/execution-plan"');
    expect(source).toContain('import { executePlan } from "../../core/execute-plan"');
    expect(source).toContain("const plan = buildExecutionPlan({");
    expect(source).toContain("await executePlan(plan)");
    expect(source).toContain("expect(mocks.runCommand).toHaveBeenCalledOnce()");
    expect(source).toContain("`hot-updater@${hotUpdaterCliManifest.version}`");
    expect(source).toContain('"init"');
    expect(source).toContain('"--scaffold-test-flag=value"');
    expect(source).toContain('"./scaffold-test-target"');
    expect(source).toContain("plan.steps[0]?.command.bin");
    expect(source).not.toContain('stdin: "ignore"');
    expect(source).not.toContain("writeToolchain");
  });

  it("keeps create-runner static identity in the exact-command assertion", () => {
    const source = renderInitTest(
      scaffoldOptions({
        commandArgs: ["--install"],
        packageName: "create-hot-updater",
        runner: "create",
        subcommand: "setup",
      }),
    );

    expect(source).toContain(
      'args: ["init", `hot-updater@${hotUpdaterCliManifest.version}`, "--", "setup", "--install"',
    );
    expect(source).not.toContain(
      'args: ["init", `hot-updater@${hotUpdaterCliManifest.version}`, "--", "init"',
    );
  });

  it("keeps an explicit create-runner subcommand in runtime and docs identity", () => {
    expect(resolveSubcommand("create-example", "create", "setup", "init")).toBe("setup");
    expect(resolveSubcommand("create-example", "create", undefined, "init")).toBeNull();
    expect(resolveSubcommand("example", "dlx", undefined, "init")).toBe("init");
  });

  it("parses canonical catalog metadata and ordered origin metadata", () => {
    const parsed = parseNewToolchainArgs([
      "hot-updater",
      "--label",
      "Hot Updater",
      "--summary",
      "Runs the official Hot Updater initializer",
      "--area",
      "app",
      "--provides",
      "mobile-ota",
      "--provides",
      "linting",
      "--order",
      "15",
      "--package",
      "hot-updater",
      "--command",
      "init",
      "--docs-url",
      "https://hot-updater.dev/docs/get-started/basic-usage",
      "--docs-must-contain",
      "hot-updater init",
      "--docs-check",
      "Confirm the exact command remains supported.",
      "--subcommand",
      "none",
      "--command-arg=--init",
      "--command-arg",
      ".",
    ]);

    expect(parsed).toMatchObject({
      area: "app",
      capabilities: ["mobile-ota", "linting"],
      command: "init",
      commandArgs: ["--init", "."],
      docsChecks: ["Confirm the exact command remains supported."],
      docsMustContain: ["hot-updater init"],
      docsUrl: "https://hot-updater.dev/docs/get-started/basic-usage",
      id: "hot-updater",
      label: "Hot Updater",
      order: 15,
      packageName: "hot-updater",
      subcommand: null,
      summary: "Runs the official Hot Updater initializer",
    });
  });

  it("rejects removed identity overrides and legacy aliases", () => {
    for (const option of [
      "--feature",
      "--stack-dir",
      "--tool",
      "--export",
      "--manifest-export",
      "--catalog",
      "--hint",
      "--cmd",
      "--pkg",
    ]) {
      expect(() => parseNewToolchainArgs(["hot-updater", option, "value"])).toThrow(
        "Unknown option",
      );
    }
  });

  it("rejects invalid or ambiguous canonical metadata", () => {
    expect(() => parseNewToolchainArgs(["hotUpdater"])).toThrow("lowercase kebab-case");
    expect(() => parseNewToolchainArgs(["../hot-updater"])).toThrow("lowercase kebab-case");
    expect(() => parseNewToolchainArgs(["plan"])).toThrow("reserved");
    expect(() => parseNewToolchainArgs(["hot-updater", "unexpected"])).toThrow(
      "Unknown argument: unexpected",
    );
    expect(() => parseNewToolchainArgs(["hot-updater", "--area", "diagnostics"])).toThrow(
      "Invalid area",
    );
    expect(() => parseNewToolchainArgs(["hot-updater", "--provides", "diagnostics"])).toThrow(
      "Invalid capability",
    );
    expect(() =>
      parseNewToolchainArgs(["hot-updater", "--provides", "linting", "--provides", "linting"]),
    ).toThrow("Duplicate capability");
    expect(() => parseNewToolchainArgs(["hot-updater", "--order", "first"])).toThrow(
      "Invalid order",
    );
    expect(() =>
      parseNewToolchainArgs(["hot-updater", "--command", "init", "--command", "setup"]),
    ).toThrow("Duplicate option");
    expect(() => parseNewToolchainArgs(["hot-updater", "--command-arg="])).toThrow(
      "cannot be empty",
    );
  });

  it("requires capabilities, order, and docs when rendering", () => {
    expect(() => renderAdapter(scaffoldOptions({ capabilities: [] }))).toThrow(
      "At least one capability",
    );
    expect(() => renderAdapter(scaffoldOptions({ order: Number.NaN }))).toThrow("finite number");
    expect(() => renderAdapter(scaffoldOptions({ docs: [] }))).toThrow("docs source");
  });

  it("documents the destructive canonical and plan-first contract", () => {
    const help = renderNewToolchainHelp();

    expect(help).toContain("yarn new <kebab-id>");
    expect(help).toContain("--label <label>");
    expect(help).toContain("--summary <summary>");
    expect(help).toContain("--area <app|testing|quality|release|editor>");
    expect(help).toContain("--provides <capability>");
    expect(help).toContain("--order <number>");
    expect(help).toContain("--command-arg <arg>");
    expect(help).toContain("--<kebab-id>.<flag>[=value]");
    expect(help).toContain("--<kebab-id>.raw.arg=<token>");
    expect(help).toContain("complete execution plan before any origin command runs");
    expect(help).toContain("There is no wrapper --yes");
    expect(help).not.toContain("--stack-dir");
    expect(help).not.toContain("managedCli");
  });
});

function scaffoldOptions(
  overrides: Partial<Parameters<typeof renderAdapter>[0]> = {},
): Parameters<typeof renderAdapter>[0] {
  return {
    area: "app",
    capabilities: ["mobile-ota"],
    command: "init",
    docs: [
      {
        confidence: "high",
        url: "https://hot-updater.dev/docs/get-started/basic-usage",
        review: {
          reason: "Adapter runs the official Hot Updater initializer.",
          files: ["src/stacks/hot-updater/adapter.ts", "src/stacks/hot-updater/init.test.ts"],
          mustContain: ["hot-updater init"],
          checks: ["Confirm the initializer remains supported."],
        },
      },
    ],
    help: true,
    id: "hot-updater",
    label: "Hot Updater",
    order: 15,
    packageName: "hot-updater",
    summary: "Runs the official Hot Updater initializer",
    ...overrides,
  };
}
