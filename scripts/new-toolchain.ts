import { cancel, intro, isCancel, log, outro, spinner, text } from "@clack/prompts";
import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";
import pc from "picocolors";

const execFileAsync = promisify(execFile);

type NewToolchainOptions = {
  adapterExportName: string;
  command: string;
  commandId?: string;
  distTag?: string;
  feature: string;
  help: boolean;
  hint?: string;
  label: string;
  manifestExportName: string;
  packageManagers?: string[];
  packageName: string;
  runner?: string;
  stackDir: string;
  subcommand?: string | null;
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

  try {
    await assertMissing(adapterPath);
    await assertMissing(indexPath);
    await mkdir(stackDir, { recursive: true });
    await writeFile(adapterPath, renderAdapter(options));
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
    await run("yarn", ["oxfmt", "--write", adapterPath, indexPath]);
    s.stop("CLI manifest generated");
  } catch (error) {
    s.stop("CLI manifest generation failed");
    log.error(`Created adapter: ${path.relative(process.cwd(), adapterPath)}`);
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
      `Manifest: ${pc.cyan(`${path.relative(process.cwd(), stackDir)}/manifest.generated.json`)}`,
    ].join("\n"),
  );
}

type ParsedArgs = {
  command?: string;
  commandId?: string;
  distTag?: string;
  feature?: string;
  help: boolean;
  hint?: string;
  label?: string;
  adapterExportName?: string;
  manifestExportName?: string;
  packageManagers?: string[];
  packageName?: string;
  runner?: string;
  stackDir?: string;
  subcommand?: string | null;
  tool?: string;
  shouldProbeHelp: boolean;
};

function parseNewToolchainArgs(argv: readonly string[]): ParsedArgs {
  const { positionals, values } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      cmd: { type: "string" },
      command: { type: "string" },
      "command-id": { type: "string" },
      "dist-tag": { type: "string" },
      export: { type: "string" },
      feature: { type: "string" },
      help: { type: "boolean", short: "h" },
      hint: { type: "string" },
      label: { type: "string" },
      "manifest-export": { type: "string" },
      "no-help": { type: "boolean" },
      package: { type: "string" },
      "package-managers": { type: "string" },
      pkg: { type: "string" },
      runner: { type: "string" },
      "stack-dir": { type: "string" },
      subcommand: { type: "string" },
      tool: { type: "string" },
    },
    strict: true,
  });

  return {
    command: values.command ?? values.cmd,
    commandId: values["command-id"],
    distTag: values["dist-tag"],
    feature: positionals[0] ?? values.feature,
    help: values.help === true,
    hint: values.hint,
    label: values.label,
    adapterExportName: values.export,
    manifestExportName: values["manifest-export"],
    packageManagers: values["package-managers"]
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    packageName: values.package ?? values.pkg,
    runner: values.runner,
    stackDir: values["stack-dir"],
    subcommand: parseSubcommand(values.subcommand),
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

  const stackDir = parsed.stackDir ?? kebabCase(feature);
  const adapterExportName = parsed.adapterExportName ?? camelCase(feature);
  const manifestExportName = parsed.manifestExportName ?? `${camelCase(feature)}CliManifest`;
  assertIdentifier(adapterExportName, "adapter export");
  assertIdentifier(manifestExportName, "manifest export");
  assertStackDir(stackDir);
  assertPackageManagers(parsed.packageManagers);
  assertRunner(parsed.runner);

  return {
    adapterExportName,
    command,
    commandId: parsed.commandId,
    distTag: parsed.distTag,
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
    tool: parsed.tool,
  };
}

async function promptRequired(options: {
  initialValue?: string;
  message: string;
  placeholder: string;
}) {
  if (options.initialValue != null) {
    return options.initialValue;
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

function assertStackDir(value: string) {
  if (value.length === 0 || path.isAbsolute(value) || value.includes("..")) {
    throw new Error(`Invalid stack directory: ${value}`);
  }
}

function assertPackageManagers(value: string[] | undefined) {
  const allowed = new Set(["npm", "pnpm", "yarn", "bun"]);
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

function renderAdapter(options: NewToolchainOptions) {
  const defaultManifestExportName = `${options.feature}CliManifest`;
  const properties: Array<readonly [string, unknown]> = [
    ["feature", options.feature],
    ["label", options.label],
    ["package", options.packageName],
    ["command", options.command],
  ];

  if (options.hint != null) properties.push(["hint", options.hint]);
  if (options.commandId != null) properties.push(["commandId", options.commandId]);
  if (options.distTag != null) properties.push(["distTag", options.distTag]);
  if (options.manifestExportName !== defaultManifestExportName) {
    properties.push(["exportName", options.manifestExportName]);
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

function renderIndex(options: NewToolchainOptions) {
  return `export { ${options.adapterExportName} } from "./adapter";
export { ${options.manifestExportName}, ${options.manifestExportName}Data } from "./manifest";
`;
}

function printHelp() {
  console.log(`Create a CLI-backed stack adapter and generate its manifest.

Usage:
  yarn new <feature> --package <package> --command <command>

Example:
  yarn new hotUpdater --label "Hot Updater" --package hot-updater --command init

Options:
  --stack-dir <name>           Directory under src/stacks. Defaults to kebab-case feature.
  --label <label>              Prompt label. Defaults to title-cased feature.
  --hint <hint>                Optional prompt hint.
  --export <name>              Adapter export name. Defaults to camel-cased feature.
  --manifest-export <name>     Manifest export name. Defaults to <feature>CliManifest.
  --tool <tool>                Manifest tool id override.
  --command-id <id>            Manifest command id override.
  --subcommand <cmd|none>      Runtime subcommand override.
  --dist-tag <tag>             npm dist-tag. Defaults to latest.
  --package-managers <list>    Comma list: npm,pnpm,yarn,bun.
  --runner <auto|create|dlx>   Package manager command inference mode.
  --no-help                    Skip CLI help probing.
`);
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
