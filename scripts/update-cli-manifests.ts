import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { CliCommandManifest } from "../src/core/cli-command-manifest";
import { defineCliCommandManifest } from "../src/core/cli-command-manifest";
import type { PackageManager } from "../src/core/package-manager";
import type {
  PackageManagerCommandTemplates,
  ToolchainAdapter,
} from "../src/core/toolchain-adapter";

type CliHelpSource = Extract<CliCommandManifest["sources"][number], { kind: "cli-help" }>;
type NpmSource = Extract<CliCommandManifest["sources"][number], { kind: "npm" }>;

const execFileAsync = promisify(execFile);
const shouldCheck = process.argv.includes("--check");

if (isMainModule()) {
  try {
    await main();
  } catch (error) {
    console.error(formatError(error));
    process.exitCode = 1;
  }
}

export async function main() {
  const toolchains = await discoverToolchains();
  const manifestInputs = toolchains.flatMap((toolchain) =>
    toolchain.adapter.cli == null ? [] : [createManifestInput(toolchain.adapter)],
  );

  const generatedFiles: GeneratedFile[] = [renderToolchainsRegistry(toolchains)];

  for (const input of manifestInputs) {
    const manifest = await createManifest(input);
    generatedFiles.push(...renderManifestFiles(input, manifest));
  }
  generatedFiles.push(renderManifestRegistry(manifestInputs));

  if (shouldCheck) {
    await checkGeneratedFiles(generatedFiles);
  } else {
    await writeGeneratedFiles(generatedFiles);
    await formatGeneratedFiles(generatedFiles.map((file) => file.path));
  }
}

type GeneratedFile = {
  path: string;
  content: string;
};

type DiscoveredToolchain = {
  adapter: ToolchainAdapter;
  exportName: string;
  stackDir: string;
};

type ManifestInput = {
  commandId: string;
  docs: NonNullable<NonNullable<ToolchainAdapter["cli"]>["docs"]>;
  distTag: string;
  exportName: string;
  help: false | undefined;
  packageManagers: readonly PackageManager[];
  packageName: string;
  runner: NonNullable<NonNullable<ToolchainAdapter["cli"]>["runner"]>;
  stackDir: string;
  subcommand: string | null;
  tool: string;
};

function createManifestInput(toolchain: ToolchainAdapter): ManifestInput {
  const cli = toolchain.cli;
  if (cli == null) {
    throw new Error(`Missing CLI definition for ${toolchain.feature}`);
  }

  const tool = cli.tool ?? kebabCase(toolchain.feature);
  return {
    commandId: cli.commandId ?? cli.command,
    distTag: cli.distTag ?? "latest",
    docs: cli.docs ?? [],
    exportName: cli.exportName ?? `${toolchain.feature}CliManifest`,
    help: cli.help,
    packageManagers: cli.packageManagers ?? ["npm", "pnpm", "yarn", "bun", "deno"],
    packageName: cli.package,
    runner: cli.runner ?? "auto",
    stackDir: cli.stackDir ?? tool,
    subcommand: cli.subcommand === undefined ? cli.command : cli.subcommand,
    tool,
  };
}

async function discoverToolchains(): Promise<DiscoveredToolchain[]> {
  const stacksDir = path.resolve("src", "stacks");
  const stackDirs = await readdir(stacksDir, { withFileTypes: true });
  const discovered = (
    await Promise.all(
      stackDirs.flatMap(async (entry) => {
        if (!entry.isDirectory()) {
          return [];
        }

        const adapterPath = path.join(stacksDir, entry.name, "adapter.ts");
        try {
          await access(adapterPath);
        } catch {
          return [];
        }

        const module = (await import(pathToFileURL(adapterPath).href)) as Record<string, unknown>;
        return Object.entries(module).flatMap(([exportName, exported]) =>
          isToolchainAdapter(exported)
            ? [{ adapter: exported, exportName, stackDir: entry.name }]
            : [],
        );
      }),
    )
  ).flat();

  return discovered.sort(compareDiscoveredToolchains);
}

function isToolchainAdapter(value: unknown): value is ToolchainAdapter {
  return (
    value != null &&
    typeof value === "object" &&
    "feature" in value &&
    typeof value.feature === "string" &&
    "label" in value &&
    typeof value.label === "string" &&
    "hint" in value &&
    typeof value.hint === "string"
  );
}

function compareDiscoveredToolchains(left: DiscoveredToolchain, right: DiscoveredToolchain) {
  return (
    (left.adapter.order ?? 1000) - (right.adapter.order ?? 1000) ||
    left.stackDir.localeCompare(right.stackDir) ||
    left.exportName.localeCompare(right.exportName)
  );
}

async function createManifest(input: ManifestInput): Promise<CliCommandManifest> {
  const { publishedAt, version } = shouldCheck
    ? await readPinnedPackageVersion(input)
    : await resolvePackageVersion(input.packageName, input.distTag);
  const docsSources = await createDocsSources(input.docs);
  const manifest = defineCliCommandManifest({
    schemaVersion: "toolchains-init/cli-command-manifest/v1",
    tool: input.tool,
    package: input.packageName,
    version,
    commands: [
      {
        id: input.commandId,
        packageManagers: resolvePackageManagerCommands(input, version),
        interactive: true,
      },
    ],
    sources: [
      {
        kind: "npm",
        package: input.packageName,
        version,
        distTag: input.distTag,
        resolvedAt: publishedAt,
      },
      ...(input.help === false
        ? []
        : [
            {
              kind: "cli-help" as const,
              command: createHelpCommand(input, version),
              commandId: input.commandId,
            },
          ]),
      ...docsSources,
    ],
  });

  return defineCliCommandManifest({
    ...manifest,
    commands: await Promise.all(
      manifest.commands.map(async (command) => ({
        ...command,
        flags: await deriveFlagsForCommand(manifest, command.id),
      })),
    ),
  });
}

async function createDocsSources(docs: ManifestInput["docs"]) {
  return Promise.all(
    docs.map(async (doc) => {
      const checks = await checkDocsContent(doc);
      return {
        kind: "docs" as const,
        ...doc,
        ...(checks.length > 0 ? { checks } : {}),
      };
    }),
  );
}

async function checkDocsContent(doc: ManifestInput["docs"][number]) {
  const expectedTexts = doc.review?.mustContain ?? [];
  if (expectedTexts.length === 0) {
    return [];
  }

  const response = await fetch(doc.url, {
    headers: {
      "user-agent": "toolchains-init-manifest-bot",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch docs for manifest source: ${doc.url} (${response.status})`);
  }

  const content = normalizeDocsContent(await response.text());
  const checks = expectedTexts.map((text) => ({
    found: content.includes(normalizeDocsContent(text)),
    text,
  }));
  const missing = checks.filter((check) => !check.found);
  if (missing.length > 0) {
    throw new Error(
      `Docs source no longer contains expected text: ${doc.url}\n${missing
        .map((check) => `- ${check.text}`)
        .join("\n")}`,
    );
  }

  return checks;
}

function normalizeDocsContent(content: string) {
  return content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolvePackageVersion(packageName: string, distTag: string) {
  const { stdout } = await execFileAsync(
    "npm",
    ["view", packageName, `dist-tags.${distTag}`, "--json"],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  const parsed = JSON.parse(stdout) as unknown;
  if (typeof parsed !== "string" || parsed.length === 0) {
    throw new Error(`Could not resolve ${packageName}@${distTag}`);
  }

  const { stdout: timeStdout } = await execFileAsync(
    "npm",
    ["view", `${packageName}@${parsed}`, "time", "--json"],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  const time = JSON.parse(timeStdout) as Record<string, unknown>;
  const publishedAt = time[parsed];
  if (typeof publishedAt !== "string" || publishedAt.length === 0) {
    throw new Error(`Could not resolve publish time for ${packageName}@${parsed}`);
  }

  return { publishedAt, version: parsed };
}

async function readPinnedPackageVersion(input: ManifestInput) {
  const manifest = defineCliCommandManifest(
    JSON.parse(await readFile(getGeneratedManifestPath(input), "utf8")),
  );
  const npmSource = manifest.sources.find(
    (source): source is NpmSource => source.kind === "npm" && source.package === input.packageName,
  );
  if (npmSource == null) {
    throw new Error(
      `Generated CLI manifest for ${input.tool} has no npm source. Run yarn manifests:update.`,
    );
  }
  if (manifest.package !== input.packageName) {
    throw new Error(
      `Generated CLI manifest for ${input.tool} uses ${manifest.package}, expected ${input.packageName}. Run yarn manifests:update.`,
    );
  }

  return { publishedAt: npmSource.resolvedAt, version: manifest.version };
}

export async function runHelpCommand(command: readonly string[]) {
  const [bin, ...args] = command;
  if (bin == null) {
    throw new Error("Help command has no binary");
  }

  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return `${stdout}\n${stderr}`;
  } catch (error) {
    const output = getProcessOutput(error);
    if (output.trim().length > 0) {
      return output;
    }
    throw error;
  }
}

function getProcessOutput(error: unknown) {
  if (error == null || typeof error !== "object") {
    return "";
  }

  return `${stringifyProcessOutput("stdout" in error ? error.stdout : undefined)}\n${stringifyProcessOutput(
    "stderr" in error ? error.stderr : undefined,
  )}`;
}

function stringifyProcessOutput(output: unknown) {
  if (typeof output === "string") {
    return output;
  }
  if (output instanceof Uint8Array) {
    return Buffer.from(output).toString("utf8");
  }
  return "";
}

function renderManifestFiles(input: ManifestInput, manifest: CliCommandManifest) {
  return [
    {
      path: getGeneratedManifestPath(input),
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: path.join(getStackDir(input), "manifest.ts"),
      content: renderManifestWrapper(input.exportName),
    },
  ];
}

function getGeneratedManifestPath(input: ManifestInput) {
  return path.join(getStackDir(input), "manifest.generated.json");
}

function getStackDir(input: ManifestInput) {
  return path.resolve("src", "stacks", input.stackDir);
}

async function checkGeneratedFiles(files: readonly GeneratedFile[]) {
  const formattedFiles = await formatInTempDir(files);
  const staleFiles: string[] = [];
  for (const file of formattedFiles) {
    let current = "";
    try {
      current = await readFile(file.path, "utf8");
    } catch {
      staleFiles.push(file.path);
      continue;
    }
    if (current !== file.content) {
      staleFiles.push(file.path);
    }
  }

  if (staleFiles.length > 0) {
    throw new Error(
      `Stale CLI manifests. Run yarn manifests:update.\n${staleFiles
        .map((file) => `- ${path.relative(process.cwd(), file)}`)
        .join("\n")}`,
    );
  }
}

async function writeGeneratedFiles(files: readonly GeneratedFile[]) {
  for (const file of files) {
    await mkdir(path.dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content);
    console.log(`updated ${path.relative(process.cwd(), file.path)}`);
  }
}

async function formatGeneratedFiles(filePaths: readonly string[]) {
  await execFileAsync("yarn", ["oxfmt", "--write", ...filePaths], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function formatInTempDir(files: readonly GeneratedFile[]) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-manifests-"));
  try {
    const tempFiles = await Promise.all(
      files.map(async (file) => {
        const relativePath = path.relative(process.cwd(), file.path);
        const tempPath = path.join(tempDir, relativePath);
        await mkdir(path.dirname(tempPath), { recursive: true });
        await writeFile(tempPath, file.content);
        return { ...file, path: tempPath, originalPath: file.path };
      }),
    );
    await formatGeneratedFiles(tempFiles.map((file) => file.path));
    return Promise.all(
      tempFiles.map(async (file) => ({
        ...file,
        content: await readFile(file.path, "utf8"),
        path: file.originalPath,
      })),
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function deriveFlagsForCommand(manifest: CliCommandManifest, commandId: string) {
  const helpSources = manifest.sources.filter((source): source is CliHelpSource =>
    isCliHelpForCommand(source, commandId, manifest.commands.length),
  );
  const flags = Object.fromEntries(
    (
      await Promise.all(
        helpSources.map(async (source) => parseHelpFlags(await runHelpCommand(source.command))),
      )
    )
      .flat()
      .map((flag) => [toFlagKey(flag.cliName), flag]),
  );

  return Object.keys(flags).length > 0 ? flags : undefined;
}

type ParsedHelpFlag =
  | {
      type: "boolean";
      cliName: string;
      supported: true;
    }
  | {
      type: "string";
      cliName: string;
      supported: true;
    }
  | {
      type: "enum";
      cliName: string;
      values: string[];
      supported: true;
    };

function parseHelpFlags(helpOutput: string): ParsedHelpFlag[] {
  return helpOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .flatMap((line) => parseHelpFlagLine(line));
}

function parseHelpFlagLine(line: string): ParsedHelpFlag[] {
  if (!line.includes("--")) {
    return [];
  }

  const [optionSpec = ""] = line.split(/\s{2,}/);
  const optionMatch =
    /(?:^|,\s*|-[A-Za-z0-9],?\s+)(--[A-Za-z0-9][A-Za-z0-9-]*)(?:[=\s]+(<[^>]+>|\[[^\]]+\]|[A-Z][A-Z0-9_-]*))?/.exec(
      optionSpec,
    );
  if (optionMatch == null) {
    return [];
  }

  const [, cliName, valueHint] = optionMatch;
  if (cliName == null) {
    return [];
  }

  const values = parseEnumValues(valueHint, line);
  if (values.length > 0) {
    return [{ type: "enum", cliName, values, supported: true }];
  }

  return [
    {
      type: valueHint == null ? "boolean" : "string",
      cliName,
      supported: true,
    },
  ];
}

function parseEnumValues(valueHint: string | undefined, line: string) {
  const fromHint = valueHint?.match(/[<[]([^>\]]*\|[^>\]]*)[>\]]/)?.[1]?.split("|") ?? [];
  if (fromHint.length > 0) {
    return fromHint.map((value) => value.trim()).filter(Boolean);
  }

  const parenthesized = line.match(/\(([^)]*,[^)]*)\)/)?.[1];
  if (parenthesized == null || /default/i.test(parenthesized)) {
    return [];
  }

  const values = parenthesized.split(",").map((value) => value.trim());
  return values.every((value) => /^[A-Za-z0-9_-]+$/.test(value)) ? values : [];
}

function toFlagKey(cliName: string) {
  const words = cliName.replace(/^--/, "").split("-").filter(Boolean);
  return words
    .map((word, index) => (index === 0 ? word : `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`))
    .join("");
}

function isCliHelpForCommand(
  source: CliCommandManifest["sources"][number],
  commandId: string,
  commandCount: number,
): source is CliHelpSource {
  return (
    source.kind === "cli-help" &&
    (source.commandId === commandId || (source.commandId == null && commandCount === 1))
  );
}

export function resolvePackageManagerCommands(
  input: ManifestInput,
  version: string,
): PackageManagerCommandTemplates {
  const runner = input.runner === "auto" ? inferRunner(input.packageName) : input.runner;
  if (typeof runner === "object") {
    return Object.fromEntries(
      input.packageManagers.flatMap((packageManager) => {
        const template = runner[packageManager];
        return template == null
          ? []
          : [[packageManager, template.map((token) => token.replaceAll(version, "{version}"))]];
      }),
    );
  }

  if (runner === "create") {
    const initializer = getCreateInitializerName(input.packageName);
    return pickPackageManagers(input.packageManagers, {
      npm: ["npm", "init", `${initializer}@{version}`, "--"],
      pnpm: ["pnpm", "create", `${initializer}@{version}`],
      yarn: ["yarn", "create", `${initializer}@{version}`],
      bun: ["bun", "create", `${initializer}@{version}`],
      deno: ["deno", "x", "-A", `npm:${input.packageName}@{version}`],
    });
  }

  const subcommand = input.subcommand == null ? [] : [input.subcommand];
  return pickPackageManagers(input.packageManagers, {
    npm: ["npx", `${input.packageName}@{version}`, ...subcommand],
    pnpm: ["pnpm", "dlx", `${input.packageName}@{version}`, ...subcommand],
    yarn: ["yarn", "dlx", `${input.packageName}@{version}`, ...subcommand],
    bun: ["bunx", `${input.packageName}@{version}`, ...subcommand],
    deno: ["deno", "x", "-A", `npm:${input.packageName}@{version}`, ...subcommand],
  });
}

function createHelpCommand(input: ManifestInput, version: string) {
  const subcommand = input.subcommand == null ? [] : [input.subcommand];
  return ["npx", "--yes", `${input.packageName}@${version}`, ...subcommand, "--help"];
}

function inferRunner(packageName: string) {
  return getPackageNameWithoutScope(packageName).startsWith("create-") ? "create" : "dlx";
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

function pickPackageManagers(
  packageManagers: readonly PackageManager[],
  templates: Required<PackageManagerCommandTemplates>,
) {
  return Object.fromEntries(
    packageManagers.map((packageManager) => [packageManager, templates[packageManager]]),
  );
}

function renderManifestWrapper(exportName: string) {
  return `// Generated by scripts/update-cli-manifests.ts. Do not edit directly.
import { defineCliCommandManifest } from "../../core/cli-command-manifest";
import ${exportName}Data from "./manifest.generated.json";

export { ${exportName}Data };
export const ${exportName} = defineCliCommandManifest(${exportName}Data);
`;
}

function renderManifestRegistry(inputs: readonly ManifestInput[]): GeneratedFile {
  const imports = inputs
    .map(
      (input) =>
        `import { ${input.exportName}, ${input.exportName}Data } from "./${input.stackDir}/manifest";`,
    )
    .join("\n");
  const manifests = inputs.map((input) => `  ${input.exportName},`).join("\n");
  const manifestData = inputs.map((input) => `  ${input.exportName}Data,`).join("\n");

  return {
    path: path.resolve("src", "stacks", "manifest-registry.generated.ts"),
    content: `// Generated by scripts/update-cli-manifests.ts. Do not edit directly.
import type { CliCommandManifest } from "../core/cli-command-manifest";
${imports}

export const cliCommandManifests = [
${manifests}
] satisfies readonly CliCommandManifest[];

export const cliCommandManifestData = [
${manifestData}
];

export function getCliCommandManifest(tool: string) {
  return cliCommandManifests.find((manifest) => manifest.tool === tool) ?? null;
}
`,
  };
}

function renderToolchainsRegistry(toolchains: readonly DiscoveredToolchain[]): GeneratedFile {
  const imports = toolchains
    .map(
      (toolchain) => `import { ${toolchain.exportName} } from "./${toolchain.stackDir}/adapter";`,
    )
    .join("\n");
  const registry = toolchains.map((toolchain) => `  ${toolchain.exportName},`).join("\n");
  const featureUnion = toolchains
    .map((toolchain) => `  | ${JSON.stringify(toolchain.adapter.feature)}`)
    .join("\n");

  return {
    path: path.resolve("src", "stacks", "toolchains.generated.ts"),
    content: `// Generated by scripts/update-cli-manifests.ts. Do not edit directly.
import type { ToolchainAdapter } from "../core/toolchain-adapter";
${imports}

export const toolchains = [
${registry}
] satisfies readonly ToolchainAdapter[];

export type BuiltInFeature =
${featureUnion};

export const ALL_FEATURES = toolchains.map((toolchain) => toolchain.feature);

export function getSelectedToolchains(features: readonly string[]) {
  return toolchains.filter((toolchain) => features.includes(toolchain.feature));
}

export async function getAvailableToolchains(
  context: Parameters<NonNullable<(typeof toolchains)[number]["isAvailable"]>>[0],
) {
  const available = await Promise.all(
    toolchains.map(async (toolchain) => ({
      toolchain,
      isAvailable: (await toolchain.isAvailable?.(context)) ?? true,
    })),
  );

  return available.filter(({ isAvailable }) => isAvailable).map(({ toolchain }) => toolchain);
}
`,
  };
}

function kebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return entrypoint != null && import.meta.url === pathToFileURL(entrypoint).href;
}

function formatError(error: unknown) {
  if (error == null || typeof error !== "object") {
    return String(error);
  }

  const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
  const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : "";
  const stdout = "stdout" in error && typeof error.stdout === "string" ? error.stdout.trim() : "";
  const output = [parseNpmViewError(stdout), stderr]
    .filter((value): value is string => value != null && value.length > 0)
    .join("\n");

  return output.length > 0 ? `${message}\n${output}` : message;
}

function parseNpmViewError(stdout: string) {
  if (stdout.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (
      parsed != null &&
      typeof parsed === "object" &&
      "error" in parsed &&
      parsed.error != null &&
      typeof parsed.error === "object" &&
      "summary" in parsed.error &&
      typeof parsed.error.summary === "string"
    ) {
      return parsed.error.summary;
    }
  } catch {
    return stdout;
  }

  return stdout;
}
