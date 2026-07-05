import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  log,
  outro,
  select,
  spinner,
} from "@clack/prompts";
import type { Option } from "@clack/prompts";
import path from "node:path";
import pc from "picocolors";
import { runExternalToolchains, runPostInstallToolchains } from "../core/external-toolchains";
import {
  existingTargetFiles,
  readPackageJson,
  writeBeforeRunToolchain,
  writeToolchain,
} from "../core/files";
import { detectPackageManager, runInstall } from "../core/package-manager";
import { getAvailableToolchains, getSelectedToolchains } from "../stacks";
import { DEFAULT_ROUTER_MODE, type Feature, type RouterMode } from "../core/types";
import type { ToolchainAdapter, ToolchainCatalog } from "../core/toolchain-adapter";

const toolchainCatalogs = [
  ["app", "App Foundation"],
  ["quality", "Quality & Testing"],
  ["release", "Release"],
  ["editor", "Editor"],
] as const satisfies readonly (readonly [ToolchainCatalog, string])[];

export async function runInit(args: string[]) {
  const unknownArg = findUnknownArg(args);
  if (unknownArg != null) {
    cancel(`Unknown argument: ${unknownArg}`);
    process.exitCode = 1;
    return;
  }

  const yes = args.includes("--yes") || args.includes("-y");
  const skipInstall = args.includes("--no-install");
  const targetFromArgs = parsePathOption(args, ["--target"]);
  if (targetFromArgs === "invalid") {
    cancel("Invalid target directory. Use --target <path>.");
    process.exitCode = 1;
    return;
  }
  const routerModeFromArgs = parseRouterMode(args);
  if (routerModeFromArgs === "invalid") {
    cancel("Invalid router mode. Use --router code or --router file.");
    process.exitCode = 1;
    return;
  }
  const cwd = path.resolve(process.cwd(), targetFromArgs ?? ".");

  intro(pc.bgBlue(pc.white(" toolchains-init ")));

  const packageJson = await readPackageJson(cwd);
  if (packageJson == null) {
    cancel(`Could not find package.json in target directory: ${cwd}`);
    process.exitCode = 1;
    return;
  }

  log.warn("Run this only in a freshly scaffolded repository.");
  log.warn(`Target directory: ${cwd}`);
  log.warn("It can overwrite router and quality-tool files.");
  log.warn("Files at the same paths may be overwritten.");

  const packageManager = detectPackageManager();
  const availableToolchains = await getAvailableToolchains({ cwd, packageJson, packageManager });
  const availableFeatures = availableToolchains.map((toolchain) => toolchain.feature);
  const features = yes ? availableFeatures : await selectFeatures(availableToolchains);
  if (features == null) {
    cancel("Initialization cancelled.");
    return;
  }
  const routerMode =
    features.includes("router") && !yes && routerModeFromArgs == null
      ? await selectRouterMode()
      : (routerModeFromArgs ?? DEFAULT_ROUTER_MODE);
  if (routerMode == null) {
    cancel("Initialization cancelled.");
    return;
  }
  if (yes && routerMode === "code") {
    cancel(
      "Code-Based Routing is selected inside the interactive TanStack CLI. Run without --yes.",
    );
    process.exitCode = 1;
    return;
  }
  const options = { features, routerMode };

  const overwritten = await existingTargetFiles(cwd, options);
  if (overwritten.length > 0 && !yes) {
    printOverwrittenFiles(overwritten);
  }
  if (overwritten.length > 0 && !yes && !(await confirmOverwrite(overwritten))) {
    cancel("Initialization cancelled.");
    return;
  }

  const s = spinner();
  s.start("Preparing toolchain");
  s.stop("Toolchain prepared");

  if (!skipInstall) {
    if (await writeBeforeRunToolchain(cwd, packageJson, options)) {
      log.info(`Running ${packageManager} install before official initializers.`);
      await runInstall(packageManager, cwd);
    }
    log.info("Running official initializers.");
    await runExternalToolchains(cwd, packageManager, options, yes);
    log.info("Official initializers completed.");
  }

  const latestPackageJson = (await readPackageJson(cwd)) ?? packageJson;
  await writeToolchain(cwd, latestPackageJson, options);
  printToolchainNotes(options);

  if (!skipInstall) {
    log.info(`Running ${packageManager} install.`);
    await runInstall(packageManager, cwd);
    log.info("Dependencies installed.");
    await runPostInstallToolchains(cwd, packageManager, options, yes);
  }

  outro(
    [pc.green("toolchains-init is ready."), `Check: ${pc.cyan(buildCheckCommand(packageManager))}`]
      .filter(Boolean)
      .join("\n"),
  );
}

function findUnknownArg(args: string[]) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--router") {
      index += 1;
      continue;
    }
    if (arg === "--target") {
      index += 1;
      continue;
    }
    if (arg != null && !arg.startsWith("-")) {
      return arg;
    }
  }
  return null;
}

function parsePathOption(args: string[], names: string[]): string | "invalid" | null {
  const inline = args.find((arg) => names.some((name) => arg.startsWith(`${name}=`)));
  const flagIndex = args.findIndex((arg) => names.includes(arg));
  const value =
    inline != null
      ? inline.slice(inline.indexOf("=") + 1)
      : flagIndex >= 0
        ? args[flagIndex + 1]
        : null;
  if (value == null) {
    return null;
  }
  if (value.length === 0 || value.startsWith("-")) {
    return "invalid";
  }
  return value;
}

function parseRouterMode(args: string[]): RouterMode | "invalid" | null {
  const inline = args.find((arg) => arg.startsWith("--router="));
  const routerFlagIndex = args.indexOf("--router");
  const value =
    inline != null ? inline.split("=")[1] : routerFlagIndex >= 0 ? args[routerFlagIndex + 1] : null;
  if (value == null) {
    return null;
  }
  if (value === "code" || value === "file") {
    return value;
  }
  return "invalid";
}

export async function selectFeatures(
  availableToolchains: Awaited<ReturnType<typeof getAvailableToolchains>>,
): Promise<Feature[] | null> {
  const selected = await groupMultiselect({
    message: "What should be initialized?",
    options: groupToolchainOptions(availableToolchains),
    required: true,
    initialValues: [],
    selectableGroups: true,
  });

  return isCancel(selected) ? null : (selected as Feature[]);
}

function groupToolchainOptions(availableToolchains: readonly ToolchainAdapter[]) {
  const entries: Array<[string, Option<Feature>[]]> = [];

  for (const [catalog, label] of toolchainCatalogs) {
    const options = availableToolchains
      .filter((toolchain) => toolchain.catalog === catalog)
      .map(
        (toolchain): Option<Feature> => ({
          value: toolchain.feature,
          label: toolchain.label,
          hint: toolchain.hint,
        }),
      );

    if (options.length > 0) {
      entries.push([label, options]);
    }
  }

  return Object.fromEntries(entries);
}

async function selectRouterMode(): Promise<RouterMode | null> {
  const selected = await select({
    message: "Which TanStack Router mode should be initialized?",
    options: [
      {
        value: "file",
        label: "File-Based Routing",
        hint: "File routes with generated routeTree.gen.ts",
      },
      {
        value: "code",
        label: "Code-Based Routing",
        hint: "Code-defined route tree",
      },
    ],
    initialValue: DEFAULT_ROUTER_MODE,
  });

  return isCancel(selected) ? null : (selected as RouterMode);
}

function printOverwrittenFiles(files: string[]) {
  const visibleFiles = files.slice(0, 12);
  for (const file of visibleFiles) {
    log.warn(`Will overwrite: ${file}`);
  }
  if (files.length > visibleFiles.length) {
    log.warn(`${files.length - visibleFiles.length} more files will be overwritten.`);
  }
}

function printToolchainNotes(options: { features: Feature[]; routerMode: RouterMode }) {
  const notes = [
    ...new Set(
      getSelectedToolchains(options.features).flatMap(
        (toolchain) => toolchain.notes?.({ options }) ?? [],
      ),
    ),
  ];

  for (const note of notes) {
    log.info(note);
  }
}

async function confirmOverwrite(files: string[]) {
  const answer = await confirm({
    message: `Overwrite these ${files.length} files?`,
    initialValue: false,
  });
  return isCancel(answer) ? false : answer;
}

function buildCheckCommand(packageManager: string) {
  if (packageManager === "npm") {
    return "npm run build";
  }
  if (packageManager === "bun") {
    return "bun run build";
  }
  if (packageManager === "deno") {
    return "deno task build";
  }
  return `${packageManager} build`;
}
