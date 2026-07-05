import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { CliCommandManifest } from "../src/core/cli-command-manifest";
import { defineCliCommandManifest } from "../src/core/cli-command-manifest";

type CliHelpSource = Extract<CliCommandManifest["sources"][number], { kind: "cli-help" }>;

const execFileAsync = promisify(execFile);
const shouldCheck = process.argv.includes("--check");
const manifestPaths = await findManifestPaths();

const generatedFiles: GeneratedFile[] = [];

for (const manifestPath of manifestPaths) {
  const manifest = await refreshManifest(manifestPath);
  generatedFiles.push(renderManifestFile(manifestPath, manifest));
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

async function findManifestPaths() {
  const stacksDir = path.resolve("src", "stacks");
  const entries = await readdir(stacksDir, { withFileTypes: true });
  const paths = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(stacksDir, entry.name, "manifest.generated.json"))
    .sort();

  if (paths.length === 0) {
    throw new Error("No CLI manifest JSON files found.");
  }

  return paths;
}

async function refreshManifest(manifestPath: string): Promise<CliCommandManifest> {
  const current = defineCliCommandManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const npmSource = current.sources.find((source) => source.kind === "npm");
  if (npmSource == null) {
    return current;
  }

  const { publishedAt, version } = await resolvePackageVersion(
    npmSource.package,
    npmSource.distTag ?? "latest",
  );
  const next = defineCliCommandManifest({
    ...current,
    package: npmSource.package,
    version,
    sources: current.sources.map((source) => {
      if (source.kind === "npm") {
        return {
          ...source,
          version,
          resolvedAt: publishedAt,
        };
      }
      if (source.kind === "cli-help") {
        return {
          ...source,
          command: source.command.map((token) => replaceVersion(token, current.version, version)),
        };
      }
      return source;
    }),
  });

  return defineCliCommandManifest({
    ...next,
    commands: await Promise.all(
      next.commands.map(async (command) => ({
        ...command,
        flags: await deriveFlagsForCommand(next, command.id),
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

function renderManifestFile(manifestPath: string, manifest: CliCommandManifest) {
  return {
    path: manifestPath,
    content: `${JSON.stringify(manifest, null, 2)}\n`,
  };
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

function replaceVersion(token: string, previousVersion: string, nextVersion: string) {
  return token.replaceAll(previousVersion, nextVersion);
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
