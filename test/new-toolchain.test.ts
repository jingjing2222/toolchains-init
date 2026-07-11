import { describe, expect, it } from "vitest";
import {
  parseNewToolchainArgs,
  renderAdapter,
  renderInitTest,
  renderNewToolchainHelp,
} from "../scripts/new-toolchain";

describe("new toolchain scaffolding", () => {
  it("renders a manifest-managed executable adapter with docs policy", () => {
    const source = renderAdapter(
      scaffoldOptions({ commandArgs: ["--init"], commandId: "setup", subcommand: null }),
    );

    expect(source).toContain("managedCli: true");
    expect(source).toContain('commandArgs: ["--init"]');
    expect(source).not.toContain("resolveCliCommand");
    expect(source).not.toContain("runCommand");
    expect(source).not.toContain("async run");
    expect(source).toContain('mustContain":["hot-updater init"]');
    expect(source).toContain("src/stacks/hot-updater/adapter.ts");
    expect(source).not.toContain("nonInteractive");
    expect(source).not.toContain("phase");
  });

  it("keeps custom manifest tool ids co-located with their adapter", () => {
    const source = renderAdapter(scaffoldOptions({ tool: "hot-update-cli" }));

    expect(source).toContain('stackDir: "hot-updater"');
    expect(source).toContain('tool: "hot-update-cli"');
  });

  it("renders an exact origin-command execution test", () => {
    const source = renderInitTest(scaffoldOptions());

    expect(source).toContain('describe("Hot Updater adapter init"');
    expect(source).toContain("expect(hotUpdater.managedCli).toBe(true)");
    expect(source).toContain('vi.mock("../../core/run-command"');
    expect(source).toContain("const command = resolveCliCommand(");
    expect(source).toContain("`hot-updater@${hotUpdaterCliManifest.version}`");
    expect(source).toContain('"init"');
    expect(source).toContain('options(["hotUpdater"])');
    expect(source).toContain("expect(mocks.runCommand).toHaveBeenCalledOnce()");
    expect(source).toContain(
      'expect(mocks.runCommand).toHaveBeenCalledWith(".", command.bin, command.args)',
    );
    expect(source).not.toContain('stdin: "ignore"');
    expect(source).not.toContain("writeToolchain");
    expect(source).not.toContain("runPostInstallToolchains");
  });

  it("keeps flag-shaped static command identity in the exact-command assertion", () => {
    const source = renderInitTest(scaffoldOptions({ commandArgs: ["--init"], subcommand: null }));

    expect(source).toContain('args: [`hot-updater@${hotUpdaterCliManifest.version}`, "--init"]');
    expect(source).not.toContain(
      'args: [`hot-updater@${hotUpdaterCliManifest.version}`, "init", "--init"]',
    );
  });

  it("parses one-command docs and ordered static command arguments", () => {
    const parsed = parseNewToolchainArgs([
      "hotUpdater",
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
      commandArgs: ["--init", "."],
      docsChecks: ["Confirm the exact command remains supported."],
      docsMustContain: ["hot-updater init"],
      docsUrl: "https://hot-updater.dev/docs/get-started/basic-usage",
      feature: "hotUpdater",
      subcommand: null,
    });
  });

  it("normalizes a non-empty package-manager list", () => {
    expect(
      parseNewToolchainArgs(["hotUpdater", "--package-managers", "npm,pnpm,npm"]).packageManagers,
    ).toEqual(["npm", "pnpm"]);
    expect(() => parseNewToolchainArgs(["hotUpdater", "--package-managers="])).toThrow(
      "at least one",
    );
    expect(() => parseNewToolchainArgs(["hotUpdater", "--package-managers", "npm,,pnpm"])).toThrow(
      "at least one",
    );
  });

  it("rejects ambiguous or invalid scaffold arguments", () => {
    expect(() => parseNewToolchainArgs(["hotUpdater", "--command-arg="])).toThrow(
      "cannot be empty",
    );
    expect(() => parseNewToolchainArgs(["hotUpdater", "unexpected"])).toThrow(
      "Unknown argument: unexpected",
    );
    expect(() => parseNewToolchainArgs(["hotUpdater", "--feature", "otherFeature"])).toThrow(
      "not both",
    );
    expect(() =>
      parseNewToolchainArgs(["hotUpdater", "--command", "init", "--cmd", "setup"]),
    ).toThrow("Duplicate option");
    expect(() =>
      parseNewToolchainArgs(["hotUpdater", "--docs-url", "one", "--docs-url", "two"]),
    ).toThrow("Duplicate option");
    expect(() =>
      parseNewToolchainArgs(["hotUpdater", "--stack-dir", "../nested/HotUpdater"]),
    ).toThrow("Invalid stack directory");
    expect(() => parseNewToolchainArgs(["URLParser"])).toThrow("Use lowerCamelCase");
    expect(() => parseNewToolchainArgs(["url_parser"])).toThrow("Use lowerCamelCase");
    expect(() => parseNewToolchainArgs(["all"])).toThrow("reserved");
  });

  it("documents all required one-command scaffold inputs", () => {
    const help = renderNewToolchainHelp();

    expect(help).toContain("--docs-url <url>");
    expect(help).toContain("--docs-must-contain <text>");
    expect(help).toContain("--command-arg <arg>");
    expect(help).toContain("lowerCamelCase feature id");
    expect(help).toContain("managedCli: true");
    expect(help).toContain("--<manifest.tool> selects the tool");
    expect(help).toContain("--<tool>.<generated-flag>[=value]");
    expect(help).toContain("--<tool>.raw.arg=<token>");
    expect(help).toContain("never changes origin CLI stdin");
  });
});

function scaffoldOptions(
  overrides: Partial<Parameters<typeof renderAdapter>[0]> = {},
): Parameters<typeof renderAdapter>[0] {
  return {
    adapterExportName: "hotUpdater",
    catalog: "app",
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
    feature: "hotUpdater",
    help: true,
    label: "Hot Updater",
    manifestExportName: "hotUpdaterCliManifest",
    packageName: "hot-updater",
    stackDir: "hot-updater",
    ...overrides,
  };
}
