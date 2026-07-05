import { execFile } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { CliCommandManifest, CliFlagContract } from "../src/core/cli-command-manifest";
import { defineCliCommandManifest } from "../src/core/cli-command-manifest";

const execFileAsync = promisify(execFile);

if (isMainModule()) {
  try {
    console.log(await renderCliManifestPrBody());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

type ManifestChange = {
  current: CliCommandManifest;
  previous: CliCommandManifest | null;
  path: string;
};

export async function renderCliManifestPrBody() {
  const changes = await findChangedManifestFiles();
  const lines = [
    "Automated daily update for generated CLI command manifests.",
    "",
    "Validation:",
    "- yarn manifests:check",
    "",
  ];

  if (changes.length === 0) {
    lines.push("No generated CLI manifest changes detected.");
    return lines.join("\n");
  }

  lines.push("## Changed manifests", "");
  for (const change of changes) {
    lines.push(...renderManifestChange(change), "");
  }

  const reviewChanges = changes
    .map((change) => ({ change, sources: getChangedDocsReviewSources(change) }))
    .filter(({ sources }) => sources.length > 0);
  if (reviewChanges.length > 0) {
    lines.push("## Docs-backed adapter review required", "");
    for (const { change, sources } of reviewChanges) {
      lines.push(...renderAdapterReview(change, sources), "");
    }
  }

  return lines.join("\n").trimEnd();
}

async function findChangedManifestFiles(): Promise<ManifestChange[]> {
  const stackDirs = await readdir(path.resolve("src", "stacks"), { withFileTypes: true });
  const manifestPaths = (
    await Promise.all(
      stackDirs
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const manifestPath = path.join("src", "stacks", entry.name, "manifest.generated.json");
          try {
            await access(manifestPath);
            return manifestPath;
          } catch {
            return null;
          }
        }),
    )
  )
    .filter((manifestPath): manifestPath is string => manifestPath != null)
    .sort();

  const changes: ManifestChange[] = [];
  for (const manifestPath of manifestPaths) {
    const currentText = await readFile(manifestPath, "utf8");
    const previousText = await readPreviousFile(manifestPath);
    if (previousText === currentText) {
      continue;
    }

    changes.push({
      current: parseManifest(currentText, manifestPath),
      previous: previousText == null ? null : parseManifest(previousText, `HEAD:${manifestPath}`),
      path: manifestPath,
    });
  }

  return changes;
}

async function readPreviousFile(filePath: string) {
  try {
    const { stdout } = await execFileAsync("git", ["show", `HEAD:${filePath}`], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

function parseManifest(text: string, label: string) {
  try {
    return defineCliCommandManifest(JSON.parse(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${label}: ${message}`);
  }
}

function renderManifestChange(change: ManifestChange) {
  const { current, previous } = change;
  const lines = [`### ${current.tool}`, `- File: \`${change.path}\``];
  if (previous == null) {
    lines.push(`- Package: \`${current.package}@${current.version}\` added`);
  } else if (previous.version !== current.version || previous.package !== current.package) {
    lines.push(
      `- Package: \`${previous.package}@${previous.version}\` -> \`${current.package}@${current.version}\``,
    );
  }

  for (const command of current.commands) {
    const previousCommand = previous?.commands.find((candidate) => candidate.id === command.id);
    if (previousCommand == null) {
      lines.push(`- Command \`${command.id}\` added`);
      continue;
    }

    const packageManagerDiff = diffPackageManagerCommands(
      previousCommand.packageManagers,
      command.packageManagers,
    );
    if (packageManagerDiff.length > 0) {
      lines.push(`- Command \`${command.id}\` templates changed: ${packageManagerDiff.join(", ")}`);
    }

    const flagDiff = diffFlags(previousCommand.flags ?? {}, command.flags ?? {});
    if (flagDiff.length > 0) {
      lines.push(`- Command \`${command.id}\` flags changed: ${flagDiff.join(", ")}`);
    }
  }

  const removedCommands =
    previous?.commands
      .filter((command) => current.commands.every((candidate) => candidate.id !== command.id))
      .map((command) => command.id) ?? [];
  if (removedCommands.length > 0) {
    lines.push(`- Commands removed: ${removedCommands.map(formatCode).join(", ")}`);
  }
  const changedDocs = getChangedDocsReviewSources(change);
  if (changedDocs.length > 0) {
    lines.push(`- Docs checks changed: ${changedDocs.map((source) => source.url).join(", ")}`);
  }

  return lines;
}

function renderAdapterReview(
  change: ManifestChange,
  reviewSources: Extract<CliCommandManifest["sources"][number], { kind: "docs" }>[],
) {
  const lines = [`### ${change.current.tool}`];
  for (const source of reviewSources) {
    const review = source.review;
    if (review == null) {
      continue;
    }

    lines.push(`- Source: ${source.url}`);
    lines.push(`- Why recheck: ${review.reason}`);
    if (review.sections != null && review.sections.length > 0) {
      lines.push(`- Watch sections: ${review.sections.map(formatCode).join(", ")}`);
    }
    if (review.files.length > 0) {
      lines.push(`- Review files: ${review.files.map(formatCode).join(", ")}`);
    }
    for (const check of review.checks ?? []) {
      lines.push(`- Check: ${check}`);
    }
  }

  return lines;
}

function getChangedDocsReviewSources(change: ManifestChange) {
  const previousDocs = new Map(
    change.previous?.sources
      .filter(
        (source): source is Extract<CliCommandManifest["sources"][number], { kind: "docs" }> =>
          source.kind === "docs",
      )
      .map((source) => [source.url, source]) ?? [],
  );

  return change.current.sources.filter(
    (source): source is Extract<CliCommandManifest["sources"][number], { kind: "docs" }> => {
      if (source.kind !== "docs" || source.review == null) {
        return false;
      }
      const previousSource = previousDocs.get(source.url);
      return JSON.stringify(previousSource?.checks ?? []) !== JSON.stringify(source.checks ?? []);
    },
  );
}

function diffPackageManagerCommands(
  previous: CliCommandManifest["commands"][number]["packageManagers"],
  current: CliCommandManifest["commands"][number]["packageManagers"],
) {
  return (["npm", "pnpm", "yarn", "bun", "deno"] as const).filter(
    (packageManager) =>
      JSON.stringify(previous[packageManager] ?? null) !==
      JSON.stringify(current[packageManager] ?? null),
  );
}

function diffFlags(
  previous: Record<string, CliFlagContract>,
  current: Record<string, CliFlagContract>,
) {
  const previousNames = new Set(Object.keys(previous));
  const currentNames = new Set(Object.keys(current));
  const added = [...currentNames].filter((name) => !previousNames.has(name)).sort();
  const removed = [...previousNames].filter((name) => !currentNames.has(name)).sort();
  const changed = [...currentNames]
    .filter(
      (name) =>
        previousNames.has(name) && JSON.stringify(previous[name]) !== JSON.stringify(current[name]),
    )
    .sort();

  return [
    ...added.map((name) => `added ${formatCode(name)}`),
    ...removed.map((name) => `removed ${formatCode(name)}`),
    ...changed.map((name) => `changed ${formatCode(name)}`),
  ];
}

function formatCode(value: string) {
  return `\`${value}\``;
}

function isMainModule() {
  const entrypoint = process.argv[1];
  return entrypoint != null && import.meta.url === pathToFileURL(entrypoint).href;
}
