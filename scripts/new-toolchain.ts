import { cancel, intro, isCancel, log, outro, select, spinner, text } from "@clack/prompts";
import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import pc from "picocolors";
import type { PackageManager } from "../src/core/package-manager";
import type { ToolchainCatalog, ToolchainCliDocs } from "../src/core/toolchain-adapter";

const execFileAsync = promisify(execFile);

type NewToolchainOptions = {
  adapterExportName: string;
  catalog: ToolchainCatalog;
  command: string;
  commandId?: string;
  distTag?: string;
  docs: readonly ToolchainCliDocs[];
  feature: string;
  help: boolean;
  hint?: string;
  interactiveOnlyReason?: string;
  label: string;
  manifestExportName: string;
  packageManagers?: PackageManager[];
  packageName: string;
  runner?: string;
  stackDir: string;
  subcommand?: string | null;
  supportsNonInteractive: boolean;
  tool?: string;
};

if (isMainModule()) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    cancel(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export async function main(argv: readonly string[]) {
  const parsed = parseNewToolchainArgs(argv);
  if (parsed.help) {
    printHelp();
    return;
  }

  intro(pc.bgBlue(pc.white(" toolchains-new ")));

  const options = await resolveOptions(parsed);
  if (options == null) {
    cancel("Stack creation cancelled.");
    process.exitCode = 1;
    return;
  }

  const stackDir = path.resolve("src", "stacks", options.stackDir);
  const adapterPath = path.join(stackDir, "adapter.ts");
  const indexPath = path.join(stackDir, "index.ts");
  const testPath = path.join(stackDir, "init.test.ts");

  try {
    await assertMissing(adapterPath);
    await assertMissing(indexPath);
    await assertMissing(testPath);
    await mkdir(stackDir, { recursive: true });
    await writeFile(adapterPath, renderAdapter(options));
    await writeFile(testPath, renderInitTest(options));
  } catch (error) {
    cancel(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const s = spinner();
  try {
    s.start("Generating CLI manifest");
    await run("yarn", ["manifests:update"]);
    await writeFile(indexPath, renderIndex(options));
    await run("yarn", ["oxfmt", "--write", adapterPath, indexPath, testPath]);
    s.stop("CLI manifest generated");
  } catch (error) {
    s.stop("CLI manifest generation failed");
    log.error(`Created adapter: ${path.relative(process.cwd(), adapterPath)}`);
    log.error(`Created init test: ${path.relative(process.cwd(), testPath)}`);
    log.error("Fix the adapter and run: yarn manifests:update");
    log.error(`Or remove ${path.relative(process.cwd(), stackDir)} and retry yarn new.`);
    printProcessError(error);
    process.exitCode = 1;
    return;
  }

  outro(
    [
      pc.green("Stack adapter created."),
      `Adapter: ${pc.cyan(path.relative(process.cwd(), adapterPath))}`,
      `Init test: ${pc.cyan(path.relative(process.cwd(), testPath))}`,
      `Manifest: ${pc.cyan(`${path.relative(process.cwd(), stackDir)}/manifest.generated.json`)}`,
      `Managed group: ${pc.cyan(`--${options.tool ?? kebabCase(options.feature)}`)}`,
      "Next: replace generated smoke-test TODOs with adapter-specific assertions before merging.",
    ].join("\n"),
  );
}

type ParsedArgs = {
  command?: string;
  catalog?: string;
  commandId?: string;
  distTag?: string;
  docsChecks?: string[];
  docsConfidence?: string;
  docsMustContain?: string[];
  docsReason?: string;
  docsSections?: string[];
  docsUrl?: string;
  feature?: string;
  help: boolean;
  hint?: string;
  label?: string;
  adapterExportName?: string;
  manifestExportName?: string;
  packageManagers?: PackageManager[];
  packageName?: string;
  runner?: string;
  stackDir?: string;
  subcommand?: string | null;
  supportsNonInteractive: boolean;
  interactiveOnlyReason?: string;
  tool?: string;
  shouldProbeHelp: boolean;
};

export function parseNewToolchainArgs(argv: readonly string[]): ParsedArgs {
  const { positionals, tokens, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      cmd: { type: "string" },
      catalog: { type: "string" },
      command: { type: "string" },
      "command-id": { type: "string" },
      "dist-tag": { type: "string" },
      "docs-check": { type: "string", multiple: true },
      "docs-confidence": { type: "string" },
      "docs-must-contain": { type: "string", multiple: true },
      "docs-reason": { type: "string" },
      "docs-section": { type: "string", multiple: true },
      "docs-url": { type: "string" },
      export: { type: "string" },
      feature: { type: "string" },
      help: { type: "boolean", short: "h" },
      hint: { type: "string" },
      label: { type: "string" },
      "manifest-export": { type: "string" },
      "interactive-only-reason": { type: "string" },
      "no-help": { type: "boolean" },
      package: { type: "string" },
      "package-managers": { type: "string" },
      pkg: { type: "string" },
      runner: { type: "string" },
      "stack-dir": { type: "string" },
      subcommand: { type: "string" },
      "supports-non-interactive": { type: "boolean" },
      tool: { type: "string" },
    },
    strict: true,
    tokens: true,
  });

  if (positionals.length > 1) {
    throw new Error(`Unknown argument: ${positionals[1]}`);
  }
  rejectDuplicateNewToolchainOptions(tokens);
  if (positionals.length === 1 && values.feature != null) {
    throw new Error("Use either a positional feature or --feature, not both.");
  }
  const feature = positionals[0] ?? values.feature;
  if (feature != null) {
    assertFeature(feature);
  }
  const interactiveOnlyReason = values["interactive-only-reason"]?.trim();
  if (values["interactive-only-reason"] != null && interactiveOnlyReason?.length === 0) {
    throw new Error("Invalid interactive-only reason: a non-empty reason is required.");
  }
  if (values["supports-non-interactive"] === true && interactiveOnlyReason != null) {
    throw new Error(
      "Use either --supports-non-interactive or --interactive-only-reason, not both.",
    );
  }
  if (values["stack-dir"] != null) {
    assertStackDir(values["stack-dir"]);
  }

  return {
    command: values.command ?? values.cmd,
    catalog: values.catalog,
    commandId: values["command-id"],
    distTag: values["dist-tag"],
    docsChecks: normalizeRepeatedValues(values["docs-check"]),
    docsConfidence: values["docs-confidence"],
    docsMustContain: normalizeRepeatedValues(values["docs-must-contain"]),
    docsReason: values["docs-reason"],
    docsSections: normalizeRepeatedValues(values["docs-section"]),
    docsUrl: values["docs-url"],
    feature,
    help: values.help === true,
    hint: values.hint,
    label: values.label,
    adapterExportName: values.export,
    manifestExportName: values["manifest-export"],
    packageManagers: parsePackageManagers(values["package-managers"]),
    packageName: values.package ?? values.pkg,
    runner: values.runner,
    stackDir: values["stack-dir"],
    subcommand: parseSubcommand(values.subcommand),
    supportsNonInteractive: values["supports-non-interactive"] === true,
    interactiveOnlyReason,
    tool: values.tool,
    shouldProbeHelp: values["no-help"] !== true,
  };
}

async function resolveOptions(parsed: ParsedArgs): Promise<NewToolchainOptions | null> {
  const feature = await promptRequired({
    initialValue: parsed.feature,
    message: "Feature id",
    placeholder: "hotUpdater",
  });
  if (feature == null) {
    return null;
  }
  assertFeature(feature);

  const packageName = await promptRequired({
    initialValue: parsed.packageName,
    message: "CLI package",
    placeholder: "hot-updater",
  });
  if (packageName == null) {
    return null;
  }

  const command = await promptRequired({
    initialValue: parsed.command,
    message: "CLI command",
    placeholder: "init",
  });
  if (command == null) {
    return null;
  }

  const docsUrl = await promptRequired({
    initialValue: parsed.docsUrl,
    message: "Official CLI/setup docs URL",
    placeholder: "https://example.com/docs/cli",
  });
  if (docsUrl == null) {
    return null;
  }

  const docsMustContain = await resolveDocsMustContain(
    parsed.docsMustContain,
    packageName,
    command,
  );
  if (docsMustContain == null) {
    return null;
  }

  const interaction = await resolveInteractionCapability(parsed);
  if (interaction == null) {
    return null;
  }

  const stackDir = parsed.stackDir ?? kebabCase(feature);
  const adapterExportName = parsed.adapterExportName ?? camelCase(feature);
  const manifestExportName = parsed.manifestExportName ?? `${camelCase(feature)}CliManifest`;
  assertIdentifier(adapterExportName, "adapter export");
  assertIdentifier(manifestExportName, "manifest export");
  assertStackDir(stackDir);
  assertCatalog(parsed.catalog);
  assertPackageManagers(parsed.packageManagers);
  assertRunner(parsed.runner);
  const docsConfidence = parseDocsConfidence(parsed.docsConfidence);
  const docsReason =
    parsed.docsReason?.trim() ||
    (interaction.supportsNonInteractive
      ? `Adapter runs the official ${parsed.label ?? titleCase(feature)} initializer through the generated command contract.`
      : `Adapter marks the official ${parsed.label ?? titleCase(feature)} initializer interactive-only because ${interaction.reason}.`);
  const docsChecks =
    parsed.docsChecks?.length != null && parsed.docsChecks.length > 0
      ? parsed.docsChecks
      : [
          `Confirm \`${packageName} ${command}\` remains the supported initializer flow.`,
          interaction.supportsNonInteractive
            ? "Confirm the complete initializer still finishes without stdin when `yes: true` is used."
            : "Confirm no stable full-argument invocation bypasses every required prompt; remove the interactive-only marker if upstream adds one.",
        ];

  return {
    adapterExportName,
    catalog: parsed.catalog ?? "quality",
    command,
    commandId: parsed.commandId,
    distTag: parsed.distTag,
    docs: [
      {
        url: docsUrl,
        confidence: docsConfidence,
        review: {
          reason: docsReason,
          files: [`src/stacks/${stackDir}/adapter.ts`, `src/stacks/${stackDir}/init.test.ts`],
          ...(parsed.docsSections != null && parsed.docsSections.length > 0
            ? { sections: parsed.docsSections }
            : {}),
          mustContain: docsMustContain,
          checks: docsChecks,
        },
      },
    ],
    feature,
    help: parsed.shouldProbeHelp,
    hint: parsed.hint,
    label: parsed.label ?? titleCase(feature),
    manifestExportName,
    packageManagers: parsed.packageManagers,
    packageName,
    runner: parsed.runner,
    stackDir,
    subcommand: parsed.subcommand,
    supportsNonInteractive: interaction.supportsNonInteractive,
    ...(interaction.reason == null ? {} : { interactiveOnlyReason: interaction.reason }),
    tool: parsed.tool,
  };
}

async function promptRequired(options: {
  initialValue?: string;
  message: string;
  placeholder: string;
}) {
  if (options.initialValue != null) {
    const value = options.initialValue.trim();
    if (value.length === 0) {
      throw new Error(`${options.message} is required.`);
    }
    return value;
  }

  const answer = await text({
    message: options.message,
    placeholder: options.placeholder,
    validate(value) {
      return value.trim().length === 0 ? "Required" : undefined;
    },
  });

  return isCancel(answer) ? null : answer.trim();
}

async function resolveDocsMustContain(
  values: string[] | undefined,
  packageName: string,
  command: string,
) {
  if (values != null && values.length > 0) {
    return [...new Set(values)];
  }

  const marker = await promptRequired({
    message: "Stable text that must remain in the docs",
    placeholder: `${packageName} ${command}`,
  });
  return marker == null ? null : [marker];
}

async function resolveInteractionCapability(parsed: ParsedArgs) {
  if (parsed.supportsNonInteractive) {
    return { supportsNonInteractive: true as const };
  }
  if (parsed.interactiveOnlyReason != null) {
    return {
      supportsNonInteractive: false as const,
      reason: parsed.interactiveOnlyReason,
    };
  }

  const answer = await select({
    message: "Can the complete initializer finish without stdin?",
    options: [
      {
        value: "interactive-only",
        label: "No, prompts remain",
        hint: "Marks the adapter interactive-only",
      },
      {
        value: "non-interactive",
        label: "Yes, fully unattended",
        hint: "Requires an enabled yes:true smoke test",
      },
    ],
    initialValue: "interactive-only",
  });
  if (isCancel(answer)) {
    return null;
  }
  if (answer === "non-interactive") {
    return { supportsNonInteractive: true as const };
  }

  const reason = await promptRequired({
    message: "Remaining prompt or project-specific choice",
    placeholder: "provider credentials require project-specific choices",
  });
  return reason == null ? null : { supportsNonInteractive: false as const, reason };
}

function parseDocsConfidence(value: string | undefined): ToolchainCliDocs["confidence"] {
  if (value == null || value === "high") {
    return "high";
  }
  if (value === "medium" || value === "low") {
    return value;
  }
  throw new Error(`Invalid docs confidence: ${value}`);
}

function normalizeRepeatedValues(values: string[] | undefined) {
  if (values == null) {
    return undefined;
  }
  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => value.length === 0)) {
    throw new Error("Repeated option values cannot be empty.");
  }
  return normalized;
}

function parsePackageManagers(value: string | undefined): PackageManager[] | undefined {
  if (value == null) {
    return undefined;
  }

  const packageManagers = value.split(",").map((manager) => manager.trim());
  if (packageManagers.length === 0 || packageManagers.some((manager) => manager.length === 0)) {
    throw new Error("Invalid package manager list: provide at least one comma-separated value.");
  }
  assertPackageManagers(packageManagers);
  return [...new Set(packageManagers)] as PackageManager[];
}

function rejectDuplicateNewToolchainOptions(tokens: readonly { kind: string; name?: string }[]) {
  const aliases = [
    ["command", "cmd"],
    ["package", "pkg"],
  ];
  const repeatable = new Set(["docs-check", "docs-must-contain", "docs-section"]);
  const optionTokens = tokens.filter(
    (token): token is { kind: "option"; name: string } =>
      token.kind === "option" && token.name != null,
  );
  const checked = new Set<string>();

  for (const aliasGroup of aliases) {
    const matches = optionTokens.filter((token) => aliasGroup.includes(token.name));
    if (matches.length > 1) {
      throw new Error(`Duplicate option: --${matches[1]?.name ?? aliasGroup[0]}.`);
    }
    aliasGroup.forEach((name) => checked.add(name));
  }

  for (const token of optionTokens) {
    if (checked.has(token.name) || repeatable.has(token.name)) {
      continue;
    }
    checked.add(token.name);
    if (optionTokens.filter((candidate) => candidate.name === token.name).length > 1) {
      throw new Error(`Duplicate option: --${token.name}.`);
    }
  }
}

function parseSubcommand(value: string | undefined) {
  if (value == null) {
    return undefined;
  }
  return value === "none" || value === "null" ? null : value;
}

function assertIdentifier(value: string, label: string) {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
    throw new Error(`Invalid ${label} name: ${value}`);
  }
}

function assertFeature(value: string) {
  if (!/^[a-z][A-Za-z0-9]*$/.test(value)) {
    throw new Error(`Invalid feature id: ${value}. Use lowerCamelCase.`);
  }
  if (value === "all") {
    throw new Error('Invalid feature id: "all" is reserved by the CLI selector.');
  }
}

function assertStackDir(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid stack directory: ${value}`);
  }
}

function assertCatalog(value: string | undefined): asserts value is ToolchainCatalog | undefined {
  if (
    value != null &&
    value !== "app" &&
    value !== "quality" &&
    value !== "release" &&
    value !== "editor"
  ) {
    throw new Error(`Invalid catalog: ${value}`);
  }
}

function assertPackageManagers(value: string[] | undefined) {
  const allowed = new Set(["npm", "pnpm", "yarn", "bun", "deno"]);
  const invalid = value?.find((manager) => !allowed.has(manager));
  if (invalid != null) {
    throw new Error(`Invalid package manager: ${invalid}`);
  }
}

function assertRunner(value: string | undefined) {
  if (value != null && value !== "auto" && value !== "create" && value !== "dlx") {
    throw new Error(`Invalid runner: ${value}`);
  }
}

async function assertMissing(file: string) {
  try {
    await access(file);
  } catch {
    return;
  }
  throw new Error(`${path.relative(process.cwd(), file)} already exists`);
}

async function run(command: string, args: readonly string[]) {
  await execFileAsync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

function printProcessError(error: unknown) {
  if (error == null || typeof error !== "object") {
    log.error(String(error));
    return;
  }

  const stdout = "stdout" in error && typeof error.stdout === "string" ? error.stdout.trim() : "";
  const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
  if (stdout.length > 0) {
    log.info(stdout);
  }
  if (stderr.length > 0) {
    log.error(stderr);
  }
  if (stdout.length === 0 && stderr.length === 0 && error instanceof Error) {
    log.error(error.message);
  }
}

export function renderAdapter(options: NewToolchainOptions) {
  if (options.docs.length === 0) {
    throw new Error("At least one docs source is required.");
  }
  if (!options.supportsNonInteractive && !options.interactiveOnlyReason?.trim()) {
    throw new Error("Interactive-only adapters require a non-empty reason.");
  }

  const defaultManifestExportName = `${options.feature}CliManifest`;
  const properties: Array<readonly [string, unknown]> = [
    ["feature", options.feature],
    ["label", options.label],
    ["catalog", options.catalog],
    ["package", options.packageName],
    ["command", options.command],
    ["managedCli", { phase: "run" }],
    ["docs", options.docs],
  ];

  if (options.hint != null) properties.push(["hint", options.hint]);
  if (options.commandId != null) properties.push(["commandId", options.commandId]);
  if (options.distTag != null) properties.push(["distTag", options.distTag]);
  if (options.manifestExportName !== defaultManifestExportName) {
    properties.push(["exportName", options.manifestExportName]);
  }
  const defaultStackDir = options.tool ?? kebabCase(options.feature);
  if (options.stackDir !== defaultStackDir) {
    properties.push(["stackDir", options.stackDir]);
  }
  if (!options.supportsNonInteractive) {
    properties.push([
      "nonInteractive",
      { supported: false, reason: options.interactiveOnlyReason },
    ]);
  }
  if (!options.help) properties.push(["help", false]);
  if (options.packageManagers != null)
    properties.push(["packageManagers", options.packageManagers]);
  if (options.runner != null) properties.push(["runner", options.runner]);
  if (options.subcommand !== undefined) properties.push(["subcommand", options.subcommand]);
  if (options.tool != null) properties.push(["tool", options.tool]);

  return `import { defineToolchain } from "../../core/toolchain-adapter";

export const ${options.adapterExportName} = defineToolchain({
${properties.map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`).join("\n")}
});
`;
}

export function renderInitTest(options: NewToolchainOptions) {
  const packageManager = options.packageManagers?.[0] ?? "npm";
  const commandId = options.commandId ?? options.command;

  if (!options.supportsNonInteractive) {
    return `import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { ${options.adapterExportName} } from "./adapter";
import { ${options.manifestExportName} } from "./manifest";
import { options } from "../init-test-utils";

const mocks = vi.hoisted(() => ({
  runCommand: vi.fn(async () => {}),
}));

vi.mock("../../core/run-command", () => ({
  runCommand: mocks.runCommand,
}));

describe("${options.label} adapter init", () => {
  beforeEach(() => {
    mocks.runCommand.mockClear();
  });

  it("declares the project-specific initializer as interactive-only", () => {
    expect(${options.adapterExportName}.managedCli).toEqual({ phase: "run" });
    expect(${options.adapterExportName}.nonInteractive).toEqual({
      supported: false,
      reason: ${JSON.stringify(options.interactiveOnlyReason)},
    });
  });

  it("runs the interactive command through its generated manifest", async () => {
    const command = resolveCliCommand(
      ${options.manifestExportName},
      ${JSON.stringify(commandId)},
      ${JSON.stringify(packageManager)},
    );
    const toolchainOptions = options([${JSON.stringify(options.feature)}]);

    await runExternalToolchains(".", ${JSON.stringify(packageManager)}, toolchainOptions, false);

    expect(mocks.runCommand).toHaveBeenCalledOnce();
    expect(mocks.runCommand.mock.calls[0]?.slice(0, 3)).toEqual([
      ".",
      command.bin,
      command.args,
    ]);
  });
});
`;
  }

  return `import { describe, expect, it } from "vitest";
import { ${options.adapterExportName} } from "./adapter";
import {
  runExternalToolchains,
  runPostInstallToolchains,
} from "../../core/external-toolchains";
import { writeToolchain } from "../../core/files";
import {
  adapterInitTimeout,
  createFreshViteProject,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("${options.label} adapter init", () => {
  it("declares a fully unattended initializer", () => {
    expect(${options.adapterExportName}.managedCli).toEqual({ phase: "run" });
    expect(${options.adapterExportName}.nonInteractive).toBeUndefined();
  });

  it(
    "scaffolds ${options.label} in lifecycle order",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);
      const toolchainOptions = options([${JSON.stringify(options.feature)}]);

      await runExternalToolchains(cwd, ${JSON.stringify(packageManager)}, toolchainOptions, true);
      // TODO: replace with files, package entries, or config produced by the external CLI.
      expect(await readPackageJson(cwd)).toBeDefined();

      await writeToolchain(cwd, packageJson, toolchainOptions);
      // TODO: replace with adapter-specific after-write expectations.
      expect(await readPackageJson(cwd)).toBeDefined();

      await runPostInstallToolchains(cwd, ${JSON.stringify(packageManager)}, toolchainOptions, true);
      // TODO: replace with adapter-specific post-install expectations.
      expect(await readPackageJson(cwd)).toBeDefined();
    },
    adapterInitTimeout,
  );
});
`;
}

function renderIndex(options: NewToolchainOptions) {
  return `export { ${options.adapterExportName} } from "./adapter";
export { ${options.manifestExportName}, ${options.manifestExportName}Data } from "./manifest";
`;
}

function printHelp() {
  console.log(renderNewToolchainHelp());
}

export function renderNewToolchainHelp() {
  return `Create a managed CLI-backed stack adapter and generate its manifest.

Usage:
  yarn new <feature> --package <package> --command <command> --docs-url <url> \\
    --docs-must-contain <text> (--supports-non-interactive | --interactive-only-reason <reason>)

Example:
  yarn new example --package create-example --command init \\
    --docs-url https://example.com/docs/cli --docs-must-contain "create-example init" \\
    --supports-non-interactive

Options:
  <feature>                    lowerCamelCase feature id, such as reactDoctor.
  --stack-dir <name>           Directory under src/stacks. Defaults to kebab-case feature.
  --label <label>              Prompt label. Defaults to title-cased feature.
  --catalog <name>             app,quality,release,editor. Defaults to quality.
  --hint <hint>                Optional prompt hint.
  --export <name>              Adapter export name. Defaults to camel-cased feature.
  --manifest-export <name>     Manifest export name. Defaults to <feature>CliManifest.
  --tool <tool>                Manifest tool and public argument-group id override.
  --command-id <id>            Manifest command id override.
  --subcommand <cmd|none>      Runtime subcommand override.
  --dist-tag <tag>             npm dist-tag. Defaults to latest.
  --package-managers <list>    Comma list: npm,pnpm,yarn,bun,deno.
  --runner <auto|create|dlx>   Package manager command inference mode.
  --no-help                    Skip CLI help probing.
  --docs-url <url>             Official CLI/setup docs URL. Required.
  --docs-confidence <level>    high,medium,low. Defaults to high.
  --docs-reason <reason>       Why the adapter policy depends on the docs.
  --docs-section <name>        Review section. Repeat for multiple sections.
  --docs-must-contain <text>   Stable docs marker. At least one; repeatable.
  --docs-check <check>         Manual review check. Repeat for multiple checks.
  --supports-non-interactive   Assert the complete yes:true path needs no stdin.
  --interactive-only-reason <reason>
                                Mark prompts that prevent unattended execution.

Generated adapter contract:
  Executable scaffolds declare managedCli: { phase: "run" }.
  --<manifest.tool> selects the tool; --<tool>.<generated-flag>[=value] forwards an option.
  Generated manifests own public flag names, types, and enum values; do not hardcode them.
`;
}

function camelCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word : `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`))
    .join("");
}

function kebabCase(value: string) {
  return value
    .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .join("-");
}

function titleCase(value: string) {
  return value
    .replace(/[A-Z]/g, (letter) => ` ${letter}`)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return entrypoint != null && import.meta.url === pathToFileURL(entrypoint).href;
}
