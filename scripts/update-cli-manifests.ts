import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { CliCommandManifest } from "../src/core/cli-command-manifest";
import { defineCliCommandManifest } from "../src/core/cli-command-manifest";
import type { PackageManager } from "../src/core/package-manager";
import type {
  PackageManagerCommandTemplates,
  ToolchainAdapter,
} from "../src/core/toolchain-adapter";
import { toolchains } from "../src/stacks/index";

type CliHelpSource = Extract<CliCommandManifest["sources"][number], { kind: "cli-help" }>;

const execFileAsync = promisify(execFile);
const shouldCheck = process.argv.includes("--check");
const manifestInputs = toolchains.flatMap((toolchain) =>
  toolchain.cli == null ? [] : [createManifestInput(toolchain)],
);

const generatedFiles: GeneratedFile[] = [];

for (const input of manifestInputs) {
  const manifest = await createManifest(input);
  generatedFiles.push(...renderManifestFiles(input, manifest));
}

if (shouldCheck) {
  await checkGeneratedFiles(generatedFiles);
} else {
  await writeGeneratedFiles(generatedFiles);
  await formatGeneratedFiles(generatedFiles.map((file) => file.path));
}

type GeneratedFile = {
  path: string;
  content: string;
};

type ManifestInput = {
  commandId: string;
  docs: readonly { url: string; confidence: "low" | "medium" | "high" }[];
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
    packageManagers: cli.packageManagers ?? ["npm", "pnpm", "yarn"],
    packageName: cli.package,
    runner: cli.runner ?? "auto",
    stackDir: cli.stackDir ?? tool,
    subcommand: cli.subcommand === undefined ? cli.command : cli.subcommand,
    tool,
  };
}

async function createManifest(input: ManifestInput): Promise<CliCommandManifest> {
  const { publishedAt, version } = await resolvePackageVersion(input.packageName, input.distTag);
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
      ...(input.docs?.map((doc) => ({ kind: "docs" as const, ...doc })) ?? []),
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

async function runHelpCommand(command: readonly string[]) {
  const [bin, ...args] = command;
  if (bin == null) {
    throw new Error("Help command has no binary");
  }

  const { stdout, stderr } = await execFileAsync(bin, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return `${stdout}\n${stderr}`;
}

function renderManifestFiles(input: ManifestInput, manifest: CliCommandManifest) {
  const stackDir = path.resolve("src", "stacks", input.stackDir);
  return [
    {
      path: path.join(stackDir, "manifest.generated.json"),
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: path.join(stackDir, "manifest.ts"),
      content: renderManifestWrapper(input.exportName),
    },
  ];
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
    /(?:^|,\s*)(--[A-Za-z0-9][A-Za-z0-9-]*)(?:[=\s]+(<[^>]+>|\[[^\]]+\]|[A-Z][A-Z0-9_-]*))?/.exec(
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

function resolvePackageManagerCommands(
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
    });
  }

  const subcommand = input.subcommand == null ? [] : [input.subcommand];
  return pickPackageManagers(input.packageManagers, {
    npm: ["npx", `${input.packageName}@{version}`, ...subcommand],
    pnpm: ["pnpm", "dlx", `${input.packageName}@{version}`, ...subcommand],
    yarn: ["yarn", "dlx", `${input.packageName}@{version}`, ...subcommand],
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
  return getPackageNameWithoutScope(packageName).replace(/^create-/, "");
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

function kebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
