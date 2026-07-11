import { describe, expect, it } from "vitest";
import {
  parseNewToolchainArgs,
  renderAdapter,
  renderInitTest,
  renderNewToolchainHelp,
} from "../scripts/new-toolchain";

describe("new toolchain scaffolding", () => {
  it("renders a manifest-managed executable adapter with docs policy", () => {
    const source = renderAdapter(scaffoldOptions({ commandId: "setup" }));

    expect(source).toContain('managedCli: {"phase":"run"}');
    expect(source).not.toContain("resolveCliCommand");
    expect(source).not.toContain("runCommand");
    expect(source).not.toContain("async run");
    expect(source).toContain('mustContain":["hot-updater init"]');
    expect(source).toContain("src/stacks/hot-updater/adapter.ts");
    expect(source).not.toContain("nonInteractive:");
  });

  it("renders only the negative non-interactive capability exception", () => {
    const source = renderAdapter(
      scaffoldOptions({
        interactiveOnlyReason: "provider credentials require project-specific choices",
        supportsNonInteractive: false,
      }),
    );

    expect(source).toContain(
      'nonInteractive: {"supported":false,"reason":"provider credentials require project-specific choices"}',
    );
  });

  it("keeps custom manifest tool ids co-located with their adapter", () => {
    const source = renderAdapter(scaffoldOptions({ tool: "hot-update-cli" }));

    expect(source).toContain('stackDir: "hot-updater"');
    expect(source).toContain('tool: "hot-update-cli"');
  });

  it("renders an enabled unattended lifecycle smoke test", () => {
    const source = renderInitTest(scaffoldOptions());

    expect(source).toContain('describe("Hot Updater adapter init"');
    expect(source).toContain('const toolchainOptions = options(["hotUpdater"]);');
    expect(source).toContain('expect(hotUpdater.managedCli).toEqual({ phase: "run" })');
    expect(source).toContain('await runExternalToolchains(cwd, "npm", toolchainOptions, true);');
    expect(source).toContain("await writeToolchain(cwd, packageJson, toolchainOptions);");
    expect(source).toContain('await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);');
    expect(source).not.toContain("it.skip(");
    expect(source).toContain("TODO: replace with files, package entries, or config");
  });

  it("renders deterministic command wiring for interactive-only adapters", () => {
    const source = renderInitTest(
      scaffoldOptions({
        interactiveOnlyReason: "provider credentials require project-specific choices",
        supportsNonInteractive: false,
      }),
    );

    expect(source).toContain('vi.mock("../../core/run-command"');
    expect(source).toContain("const command = resolveCliCommand(");
    expect(source).toContain("hotUpdaterCliManifest");
    expect(source).toContain('runExternalToolchains(".", "npm", toolchainOptions, false)');
    expect(source).toContain("expect(mocks.runCommand).toHaveBeenCalledOnce()");
    expect(source).toContain("mocks.runCommand.mock.calls[0]?.slice(0, 3)");
    expect(source).not.toContain("hotUpdater.run");
  });

  it("parses one-command docs and interaction policy arguments", () => {
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
      "Confirm provider setup remains interactive.",
      "--interactive-only-reason",
      "provider setup requires project-specific choices",
    ]);

    expect(parsed).toMatchObject({
      docsChecks: ["Confirm provider setup remains interactive."],
      docsMustContain: ["hot-updater init"],
      docsUrl: "https://hot-updater.dev/docs/get-started/basic-usage",
      feature: "hotUpdater",
      interactiveOnlyReason: "provider setup requires project-specific choices",
      supportsNonInteractive: false,
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

  it("rejects ambiguous or empty interaction policy arguments", () => {
    expect(() =>
      parseNewToolchainArgs([
        "hotUpdater",
        "--supports-non-interactive",
        "--interactive-only-reason",
        "provider prompt remains",
      ]),
    ).toThrow("not both");
    expect(() => parseNewToolchainArgs(["hotUpdater", "--interactive-only-reason="])).toThrow(
      "non-empty reason",
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
    expect(help).toContain("--supports-non-interactive");
    expect(help).toContain("--interactive-only-reason <reason>");
    expect(help).toContain("lowerCamelCase feature id");
    expect(help).toContain('managedCli: { phase: "run" }');
    expect(help).toContain("--<manifest.tool> selects the tool");
    expect(help).toContain("--<tool>.<generated-flag>[=value]");
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
    supportsNonInteractive: true,
    ...overrides,
  };
}
