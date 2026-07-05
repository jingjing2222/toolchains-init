import * as v from "valibot";
import type { InferOutput } from "valibot";
import type { PackageManager } from "./package-manager";

const cliManifestSourceSchema = v.union([
  v.object({
    kind: v.literal("npm"),
    package: v.string(),
    version: v.string(),
    distTag: v.optional(v.string()),
    resolvedAt: v.string(),
  }),
  v.object({
    kind: v.literal("cli-help"),
    command: v.array(v.string()),
  }),
  v.object({
    kind: v.literal("docs"),
    url: v.string(),
    confidence: v.picklist(["low", "medium", "high"]),
  }),
]);

const cliFlagContractSchema = v.union([
  v.object({
    type: v.literal("boolean"),
    cliName: v.string(),
    supported: v.boolean(),
  }),
  v.object({
    type: v.literal("enum"),
    cliName: v.string(),
    values: v.array(v.string()),
    supported: v.boolean(),
  }),
  v.object({
    type: v.literal("string"),
    cliName: v.string(),
    supported: v.boolean(),
  }),
]);

const packageManagerCommandsSchema = v.object({
  npm: v.optional(v.array(v.string())),
  pnpm: v.optional(v.array(v.string())),
  yarn: v.optional(v.array(v.string())),
});

const cliCommandContractSchema = v.object({
  id: v.string(),
  packageManagers: packageManagerCommandsSchema,
  flags: v.optional(v.record(v.string(), cliFlagContractSchema)),
  interactive: v.boolean(),
});

export const cliCommandManifestSchema = v.object({
  schemaVersion: v.literal("toolchains-init/cli-command-manifest/v1"),
  tool: v.string(),
  package: v.string(),
  version: v.string(),
  commands: v.array(cliCommandContractSchema),
  sources: v.array(cliManifestSourceSchema),
});

export type CliManifestSource = InferOutput<typeof cliManifestSourceSchema>;
export type CliFlagContract = InferOutput<typeof cliFlagContractSchema>;
export type CliCommandContract = InferOutput<typeof cliCommandContractSchema>;
export type CliCommandManifest = InferOutput<typeof cliCommandManifestSchema>;

export function defineCliCommandManifest(manifest: unknown) {
  return v.parse(cliCommandManifestSchema, manifest);
}

export function resolveCliCommand(
  manifest: CliCommandManifest,
  commandId: string,
  packageManager: PackageManager,
  flags: Record<string, boolean | string> = {},
) {
  const command = manifest.commands.find((candidate) => candidate.id === commandId);
  if (command == null) {
    throw new Error(`Unknown CLI command contract: ${manifest.tool}/${commandId}`);
  }

  const template = command.packageManagers[packageManager];
  if (template == null) {
    throw new Error(
      `CLI command contract ${manifest.tool}/${commandId} does not support ${packageManager}`,
    );
  }

  const tokens = [
    ...template.map((token) => token.replaceAll("{version}", manifest.version)),
    ...serializeCliFlags(command, flags),
  ];
  const [bin, ...args] = tokens;
  if (bin == null) {
    throw new Error(`CLI command contract ${manifest.tool}/${commandId} has no binary`);
  }

  return { bin, args };
}

export function formatCliCommand(command: { bin: string; args: readonly string[] }) {
  return [command.bin, ...command.args].map(formatShellToken).join(" ");
}

function serializeCliFlags(command: CliCommandContract, values: Record<string, boolean | string>) {
  const result: string[] = [];
  const flags = command.flags ?? {};

  for (const [name, value] of Object.entries(values)) {
    const flag = flags[name];
    if (flag == null || !flag.supported) {
      throw new Error(`Unsupported CLI flag for ${command.id}: ${name}`);
    }

    if (flag.type === "boolean") {
      if (value === true) {
        result.push(flag.cliName);
      }
      continue;
    }

    if (flag.type === "string") {
      if (typeof value !== "string") {
        throw new Error(`Invalid CLI flag value for ${command.id}: ${name}=${String(value)}`);
      }
      result.push(flag.cliName, value);
      continue;
    }

    if (typeof value !== "string" || !flag.values.includes(value)) {
      throw new Error(`Invalid CLI flag value for ${command.id}: ${name}=${String(value)}`);
    }
    result.push(flag.cliName, value);
  }

  return result;
}

function formatShellToken(token: string) {
  return /^[A-Za-z0-9_./:@=-]+$/.test(token) ? token : JSON.stringify(token);
}
