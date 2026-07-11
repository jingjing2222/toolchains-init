import { cancel, intro, isCancel, log, outro, spinner, text } from "@clack/prompts";
import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import pc from "picocolors";
import type { ToolchainArea, ToolchainOriginDocs } from "../src/core/toolchain-adapter";
import { toolchainCapabilities, type ToolchainCapability } from "../src/core/toolchain-catalog";

const execFileAsync = promisify(execFile);
const areas = ["app", "testing", "quality", "release", "editor"] as const;
const reservedIds = new Set(["help", "package-manager", "plan", "target", "version"]);

type NewToolchainOptions = {
  area: ToolchainArea;
  capabilities: readonly ToolchainCapability[];
  command: string;
  commandArgs?: readonly string[];
  commandId?: string;
  distTag?: string;
  docs: readonly ToolchainOriginDocs[];
  help: boolean;
  id: string;
  label: string;
  order: number;
  packageName: string;
  runner?: "auto" | "create" | "dlx";
  subcommand?: string | null;
  summary: string;
};

type ParsedArgs = {
  area?: ToolchainArea;
  capabilities?: ToolchainCapability[];
  command?: string;
  commandArgs?: string[];
  commandId?: string;
  distTag?: string;
  docsChecks?: string[];
  docsConfidence?: ToolchainOriginDocs["confidence"];
  docsMustContain?: string[];
  docsReason?: string;
  docsSections?: string[];
  docsUrl?: string;
  help: boolean;
  id?: string;
  label?: string;
  order?: number;
  packageName?: string;
  runner?: "auto" | "create" | "dlx";
  shouldProbeHelp: boolean;
  subcommand?: string | null;
  summary?: string;
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
    cancel("Toolchain creation cancelled.");
    process.exitCode = 1;
    return;
  }

  const stackDir = path.resolve("src", "stacks", options.id);
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
      pc.green("Toolchain adapter created."),
      `Adapter: ${pc.cyan(path.relative(process.cwd(), adapterPath))}`,
      `Init test: ${pc.cyan(path.relative(process.cwd(), testPath))}`,
      `Manifest: ${pc.cyan(`${path.relative(process.cwd(), stackDir)}/manifest.generated.json`)}`,
      `Selector: ${pc.cyan(`--${options.id}`)}`,
      "Next: verify the generated test matches the exact documented origin command.",
    ].join("\n"),
  );
}

export function parseNewToolchainArgs(argv: readonly string[]): ParsedArgs {
  const { positionals, tokens, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      area: { type: "string" },
      command: { type: "string" },
      "command-arg": { type: "string", multiple: true },
      "command-id": { type: "string" },
      "dist-tag": { type: "string" },
      "docs-check": { type: "string", multiple: true },
      "docs-confidence": { type: "string" },
      "docs-must-contain": { type: "string", multiple: true },
      "docs-reason": { type: "string" },
      "docs-section": { type: "string", multiple: true },
      "docs-url": { type: "string" },
      help: { type: "boolean", short: "h" },
      label: { type: "string" },
      "no-help": { type: "boolean" },
      order: { type: "string" },
      package: { type: "string" },
      provides: { type: "string", multiple: true },
      runner: { type: "string" },
      subcommand: { type: "string" },
      summary: { type: "string" },
    },
    strict: true,
    tokens: true,
  });

  if (positionals.length > 1) {
    throw new Error(`Unknown argument: ${positionals[1]}`);
  }
  rejectDuplicateOptions(tokens);

  const id = positionals[0];
  if (id != null) {
    assertCanonicalId(id);
  }

  return {
    area: parseArea(values.area),
    capabilities: parseCapabilities(normalizeRepeatedValues(values.provides)),
    command: normalizeOptionalValue(values.command, "command"),
    commandArgs: normalizeCommandArgs(values["command-arg"]),
    commandId: normalizeOptionalValue(values["command-id"], "command id"),
    distTag: normalizeOptionalValue(values["dist-tag"], "dist tag"),
    docsChecks: normalizeRepeatedValues(values["docs-check"]),
    docsConfidence: parseDocsConfidence(values["docs-confidence"]),
    docsMustContain: normalizeRepeatedValues(values["docs-must-contain"]),
    docsReason: normalizeOptionalValue(values["docs-reason"], "docs reason"),
    docsSections: normalizeRepeatedValues(values["docs-section"]),
    docsUrl: normalizeOptionalValue(values["docs-url"], "docs URL"),
    help: values.help === true,
    id,
    label: normalizeOptionalValue(values.label, "label"),
    order: parseOrder(values.order),
    packageName: normalizeOptionalValue(values.package, "package"),
    runner: parseRunner(values.runner),
    shouldProbeHelp: values["no-help"] !== true,
    subcommand: parseSubcommand(values.subcommand),
    summary: normalizeOptionalValue(values.summary, "summary"),
  };
}

async function resolveOptions(parsed: ParsedArgs): Promise<NewToolchainOptions | null> {
  const id = await promptRequired({
    initialValue: parsed.id,
    message: "Canonical toolchain id",
    placeholder: "hot-updater",
  });
  if (id == null) return null;
  assertCanonicalId(id);

  const label = await promptRequired({
    initialValue: parsed.label,
    message: "Display label",
    placeholder: "Hot Updater",
  });
  if (label == null) return null;

  const summary = await promptRequired({
    initialValue: parsed.summary,
    message: "Catalog summary",
    placeholder: "Runs the official Hot Updater initializer",
  });
  if (summary == null) return null;

  const areaValue = await promptRequired({
    initialValue: parsed.area,
    message: "Catalog area",
    placeholder: areas.join(", "),
  });
  if (areaValue == null) return null;
  const area = parseArea(areaValue);
  if (area == null) throw new Error("Catalog area is required.");

  const capabilityValue = await promptRequired({
    initialValue: parsed.capabilities?.join(","),
    message: "Capabilities (comma-separated)",
    placeholder: Object.keys(toolchainCapabilities).join(", "),
  });
  if (capabilityValue == null) return null;
  const capabilities = parseCapabilities(capabilityValue.split(","));
  if (capabilities == null) throw new Error("At least one capability is required.");

  const orderValue = await promptRequired({
    initialValue: parsed.order?.toString(),
    message: "Catalog order",
    placeholder: "40",
  });
  if (orderValue == null) return null;
  const order = parseOrder(orderValue);
  if (order == null) throw new Error("Catalog order is required.");

  const packageName = await promptRequired({
    initialValue: parsed.packageName,
    message: "CLI package",
    placeholder: "hot-updater",
  });
  if (packageName == null) return null;

  const command = await promptRequired({
    initialValue: parsed.command,
    message: "CLI command id",
    placeholder: "init",
  });
  if (command == null) return null;

  const docsUrl = await promptRequired({
    initialValue: parsed.docsUrl,
    message: "Official CLI/setup docs URL",
    placeholder: "https://example.com/docs/cli",
  });
  if (docsUrl == null) return null;

  const docsMustContain = await resolveDocsMustContain(
    parsed.docsMustContain,
    packageName,
    command,
  );
  if (docsMustContain == null) return null;

  const docsReason =
    parsed.docsReason ??
    `Adapter runs the exact official ${label} command as the only project mutation.`;
  const docsChecks =
    parsed.docsChecks != null && parsed.docsChecks.length > 0
      ? parsed.docsChecks
      : [
          `Confirm \`${formatOriginCommand(
            packageName,
            resolveSubcommand(packageName, parsed.runner, parsed.subcommand, command),
            parsed.commandArgs,
          )}\` remains the supported initializer.`,
          "Confirm the wrapper only plans and invokes this command and never changes the project itself.",
        ];

  return {
    area,
    capabilities,
    command,
    commandArgs: parsed.commandArgs,
    commandId: parsed.commandId,
    distTag: parsed.distTag,
    docs: [
      {
        url: docsUrl,
        confidence: parsed.docsConfidence ?? "high",
        review: {
          reason: docsReason,
          files: [`src/stacks/${id}/adapter.ts`, `src/stacks/${id}/init.test.ts`],
          ...(parsed.docsSections != null && parsed.docsSections.length > 0
            ? { sections: parsed.docsSections }
            : {}),
          mustContain: docsMustContain,
          checks: docsChecks,
        },
      },
    ],
    help: parsed.shouldProbeHelp,
    id,
    label,
    order,
    packageName,
    runner: parsed.runner,
    subcommand: parsed.subcommand,
    summary,
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

function normalizeOptionalValue(value: string | undefined, label: string) {
  if (value == null) return undefined;
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function normalizeRepeatedValues(values: string[] | undefined) {
  if (values == null) return undefined;
  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => value.length === 0)) {
    throw new Error("Repeated option values cannot be empty.");
  }
  return normalized;
}

function normalizeCommandArgs(values: string[] | undefined) {
  if (values == null) return undefined;
  if (values.some((value) => value.length === 0)) {
    throw new Error("Command argument values cannot be empty.");
  }
  return [...values];
}

function parseArea(value: string | undefined): ToolchainArea | undefined {
  if (value == null) return undefined;
  if (areas.some((area) => area === value)) return value as ToolchainArea;
  throw new Error(`Invalid area: ${value}. Expected one of: ${areas.join(", ")}.`);
}

function parseCapabilities(values: string[] | undefined): ToolchainCapability[] | undefined {
  if (values == null) return undefined;
  const capabilities = values.map((value) => value.trim());
  if (capabilities.length === 0 || capabilities.some((value) => value.length === 0)) {
    throw new Error("At least one nonempty --provides capability is required.");
  }
  const duplicate = capabilities.find(
    (capability, index) => capabilities.indexOf(capability) !== index,
  );
  if (duplicate != null) {
    throw new Error(`Duplicate capability: ${duplicate}.`);
  }
  const supported = Object.keys(toolchainCapabilities);
  const invalid = capabilities.find((capability) => !supported.includes(capability));
  if (invalid != null) {
    throw new Error(`Invalid capability: ${invalid}. Expected one of: ${supported.join(", ")}.`);
  }
  return capabilities as ToolchainCapability[];
}

function parseOrder(value: string | undefined) {
  if (value == null) return undefined;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) {
    throw new Error(`Invalid order: ${value}. Expected a finite number.`);
  }
  const order = Number(value);
  if (!Number.isFinite(order)) {
    throw new Error(`Invalid order: ${value}. Expected a finite number.`);
  }
  return order;
}

function parseRunner(value: string | undefined): ParsedArgs["runner"] {
  if (value == null || value === "auto" || value === "create" || value === "dlx") {
    return value;
  }
  throw new Error(`Invalid runner: ${value}. Expected one of: auto, create, dlx.`);
}

function parseSubcommand(value: string | undefined) {
  if (value == null) return undefined;
  if (value.length === 0) throw new Error("subcommand cannot be empty.");
  return value === "none" ? null : value;
}

function parseDocsConfidence(
  value: string | undefined,
): ToolchainOriginDocs["confidence"] | undefined {
  if (value == null || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  throw new Error(`Invalid docs confidence: ${value}. Expected one of: high, medium, low.`);
}

function formatOriginCommand(
  packageName: string,
  subcommand: string | null,
  commandArgs: readonly string[] | undefined,
) {
  return [packageName, ...(subcommand == null ? [] : [subcommand]), ...(commandArgs ?? [])].join(
    " ",
  );
}

function rejectDuplicateOptions(tokens: readonly { kind: string; name?: string }[]) {
  const repeatable = new Set([
    "command-arg",
    "docs-check",
    "docs-must-contain",
    "docs-section",
    "provides",
  ]);
  const optionTokens = tokens.filter(
    (token): token is { kind: "option"; name: string } =>
      token.kind === "option" && token.name != null,
  );
  const seen = new Set<string>();

  for (const token of optionTokens) {
    if (repeatable.has(token.name)) continue;
    if (seen.has(token.name)) {
      throw new Error(`Duplicate option: --${token.name}.`);
    }
    seen.add(token.name);
  }
}

function assertCanonicalId(value: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid toolchain id: ${value}. Use lowercase kebab-case.`);
  }
  if (reservedIds.has(value)) {
    throw new Error(`Invalid toolchain id: ${value} is reserved by the CLI.`);
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
  if (stdout.length > 0) log.info(stdout);
  if (stderr.length > 0) log.error(stderr);
  if (stdout.length === 0 && stderr.length === 0 && error instanceof Error) {
    log.error(error.message);
  }
}

export function renderAdapter(options: NewToolchainOptions) {
  assertRenderableOptions(options);
  const originProperties: Array<readonly [string, unknown]> = [
    ["package", options.packageName],
    ["command", options.command],
  ];
  if (options.commandArgs != null && options.commandArgs.length > 0) {
    originProperties.push(["commandArgs", options.commandArgs]);
  }
  if (options.commandId != null) originProperties.push(["commandId", options.commandId]);
  if (options.distTag != null) originProperties.push(["distTag", options.distTag]);
  if (!options.help) originProperties.push(["help", false]);
  if (options.runner != null) originProperties.push(["runner", options.runner]);
  if (options.subcommand !== undefined) originProperties.push(["subcommand", options.subcommand]);
  originProperties.push(["docs", options.docs]);

  return `import { defineToolchain } from "../../core/toolchain-adapter";

export const ${camelCase(options.id)} = defineToolchain({
  id: ${JSON.stringify(options.id)},
  label: ${JSON.stringify(options.label)},
  summary: ${JSON.stringify(options.summary)},
  area: ${JSON.stringify(options.area)},
  capabilities: ${JSON.stringify(options.capabilities)},
  order: ${JSON.stringify(options.order)},
  origin: {
${originProperties.map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`).join("\n")}
  },
});
`;
}

export function renderInitTest(options: NewToolchainOptions) {
  assertRenderableOptions(options);
  const adapterExportName = camelCase(options.id);
  const manifestExportName = `${adapterExportName}CliManifest`;
  const routedArgs = ["--scaffold-test-flag=value", "./scaffold-test-target"];
  const expectedCommand = renderExpectedOriginCommand(options, manifestExportName, routedArgs);

  return `import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCliOptions } from "../../core/cli-options";
import { executePlan } from "../../core/execute-plan";
import { buildExecutionPlan } from "../../core/execution-plan";
import { ${adapterExportName} } from "./adapter";
import { ${manifestExportName} } from "./manifest";

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

  it("plans and hands off the exact origin command once without mutation hooks", async () => {
    expect(${adapterExportName}).toMatchObject({
      id: ${JSON.stringify(options.id)},
      area: ${JSON.stringify(options.area)},
      capabilities: ${JSON.stringify(options.capabilities)},
      origin: {
        package: ${JSON.stringify(options.packageName)},
        command: ${JSON.stringify(options.command)},
      },
    });
    for (const mutationHook of [
      "afterInstall",
      "afterWrite",
      "beforeRun",
      "execute",
      "updatePackageJson",
    ]) {
      expect(${adapterExportName}).not.toHaveProperty(mutationHook);
    }

    const parsed = parseCliOptions([
      ${JSON.stringify(`--${options.id}`)},
      ${JSON.stringify(`--${options.id}.scaffold-test-flag=value`)},
      ${JSON.stringify(`--${options.id}.raw.arg=./scaffold-test-target`)},
    ]);
    expect(parsed.originArgs[${JSON.stringify(options.id)}]).toEqual(${JSON.stringify(routedArgs)});

    const plan = buildExecutionPlan({
      cwd: ".",
      manifests: [${manifestExportName}],
      packageManager: "npm",
      selectedToolchains: [${adapterExportName}],
      userArgs: parsed.originArgs,
    });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toEqual({
      id: ${JSON.stringify(options.id)},
      label: ${JSON.stringify(options.label)},
      packageName: ${JSON.stringify(options.packageName)},
      packageVersion: ${manifestExportName}.version,
      command: ${expectedCommand},
      source: ${JSON.stringify(options.docs[0]?.url)},
    });

    await executePlan(plan);

    expect(mocks.runCommand).toHaveBeenCalledOnce();
    expect(mocks.runCommand).toHaveBeenCalledWith(
      ".",
      plan.steps[0]?.command.bin,
      plan.steps[0]?.command.args,
    );
  });
});
`;
}

function renderExpectedOriginCommand(
  options: NewToolchainOptions,
  manifestExportName: string,
  userArgs: readonly string[],
) {
  const runner = resolveRunner(options.packageName, options.runner);
  const commandArgs = [...(options.commandArgs ?? []), ...userArgs];
  const args: string[] = [];
  let bin: string;
  let versionedPackage: string;

  if (runner === "create") {
    bin = "npm";
    versionedPackage = getCreateInitializerName(options.packageName);
    const subcommand = options.subcommand == null ? [] : [options.subcommand];
    args.push("init", versionedPackage, "--", ...subcommand, ...commandArgs);
  } else {
    bin = "npx";
    versionedPackage = options.packageName;
    const subcommand = options.subcommand === undefined ? options.command : options.subcommand;
    args.push(versionedPackage, ...(subcommand == null ? [] : [subcommand]), ...commandArgs);
  }

  const renderedArgs = args.map((argument, index) =>
    index === (runner === "create" ? 1 : 0)
      ? `\`${argument}@\${${manifestExportName}.version}\``
      : JSON.stringify(argument),
  );
  return `{ bin: ${JSON.stringify(bin)}, args: [${renderedArgs.join(", ")}] }`;
}

function assertRenderableOptions(options: NewToolchainOptions) {
  assertCanonicalId(options.id);
  if (options.capabilities.length === 0) {
    throw new Error("At least one capability is required.");
  }
  if (options.docs.length === 0) {
    throw new Error("At least one docs source is required.");
  }
  if (!Number.isFinite(options.order)) {
    throw new Error("Catalog order must be a finite number.");
  }
}

function renderIndex(options: NewToolchainOptions) {
  const adapterExportName = camelCase(options.id);
  const manifestExportName = `${adapterExportName}CliManifest`;
  return `export { ${adapterExportName} } from "./adapter";
export { ${manifestExportName}, ${manifestExportName}Data } from "./manifest";
`;
}

function printHelp() {
  console.log(renderNewToolchainHelp());
}

export function renderNewToolchainHelp() {
  return `Create a canonical origin-CLI toolchain and generate its pinned manifest.

Usage:
  yarn new <kebab-id> --label <label> --summary <summary> \\
    --area <app|testing|quality|release|editor> --provides <capability> \\
    --order <number> --package <package> --command <command> --docs-url <url> \\
    --docs-must-contain <text>

Example:
  yarn new example --label "Example" --summary "Runs the official Example initializer" \\
    --area quality --provides linting --order 40 --package create-example \\
    --command init --docs-url https://example.com/docs/cli \\
    --docs-must-contain "create-example init"

Catalog options:
  <kebab-id>                   Canonical directory, adapter, manifest, and selector id.
  --label <label>              User-facing catalog label. Required.
  --summary <summary>          Concise description of the upstream initializer. Required.
  --area <area>                app, testing, quality, release, or editor. Required.
  --provides <capability>      Catalog capability; required and repeatable.
  --order <number>             Numeric catalog order. Required.

Origin command options:
  --package <package>          Official origin CLI package. Required.
  --command <command>          Stable command identity. Required.
  --command-id <id>            Generated manifest command id override.
  --subcommand <cmd|none>      Runtime subcommand override; none suppresses it.
  --command-arg <arg>          Static origin-command token; repeat to preserve order.
  --dist-tag <tag>             npm dist-tag. Defaults to latest.
  --runner <auto|create|dlx>   Package-manager command inference mode.
  --no-help                    Skip origin CLI help probing.

Documentation evidence:
  --docs-url <url>             Official CLI/setup docs URL. Required.
  --docs-confidence <level>    high, medium, or low. Defaults to high.
  --docs-reason <reason>       What the official source proves.
  --docs-section <name>        Review section; repeatable.
  --docs-must-contain <text>   Stable docs marker; at least one and repeatable.
  --docs-check <check>         Manual review check; repeatable.

Generated CLI contract:
  --<kebab-id> selects the tool.
  --<kebab-id>.<flag>[=value] forwards an opaque namespaced origin option.
  --<kebab-id>.raw.arg=<token> forwards one exact token; repeat to preserve order.
  The wrapper builds and prints the complete execution plan before any origin command runs.
  There is no wrapper --yes; an origin --<kebab-id>.yes option remains opaque passthrough.
`;
}

function resolveRunner(packageName: string, runner: NewToolchainOptions["runner"]) {
  return runner == null || runner === "auto"
    ? getPackageNameWithoutScope(packageName).startsWith("create-")
      ? "create"
      : "dlx"
    : runner;
}

export function resolveSubcommand(
  packageName: string,
  runner: NewToolchainOptions["runner"],
  subcommand: string | null | undefined,
  command: string,
) {
  if (resolveRunner(packageName, runner) === "create") {
    return subcommand === undefined ? null : subcommand;
  }
  return subcommand === undefined ? command : subcommand;
}

function getCreateInitializerName(packageName: string) {
  const scopedPackageMatch = /^(@[^/]+)\/(.+)$/.exec(packageName);
  if (scopedPackageMatch != null) {
    const [, scope, packageNameWithoutScope] = scopedPackageMatch;
    return `${scope}/${packageNameWithoutScope?.replace(/^create-/, "")}`;
  }
  return packageName.replace(/^create-/, "");
}

function getPackageNameWithoutScope(packageName: string) {
  return packageName.split("/").at(-1) ?? packageName;
}

function camelCase(value: string) {
  return value.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return entrypoint != null && import.meta.url === pathToFileURL(entrypoint).href;
}
