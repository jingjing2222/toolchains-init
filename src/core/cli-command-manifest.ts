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
    commandId: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("docs"),
    url: v.string(),
    confidence: v.picklist(["low", "medium", "high"]),
    checks: v.optional(
      v.array(
        v.object({
          found: v.boolean(),
          text: v.string(),
        }),
      ),
    ),
    review: v.optional(
      v.object({
        reason: v.string(),
        files: v.array(v.string()),
        sections: v.optional(v.array(v.string())),
        mustContain: v.optional(v.array(v.string())),
        checks: v.optional(v.array(v.string())),
      }),
    ),
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
  bun: v.optional(v.array(v.string())),
  deno: v.optional(v.array(v.string())),
});

const cliCommandContractSchema = v.object({
  id: v.string(),
  packageManagers: packageManagerCommandsSchema,
  flags: v.optional(v.record(v.string(), cliFlagContractSchema)),
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
  const parsed = v.parse(cliCommandManifestSchema, manifest);
  validateManifestIdentities(parsed);
  return parsed;
}

export function resolveCliCommand(
  manifest: CliCommandManifest,
  commandId: string,
  packageManager: PackageManager,
  flags: Record<string, boolean | string> = {},
  positionals: readonly string[] = [],
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
    ...positionals,
    ...serializeCliFlags(command, flags),
  ];
  const [bin, ...args] = tokens;
  if (bin == null) {
    throw new Error(`CLI command contract ${manifest.tool}/${commandId} has no binary`);
  }

  return { bin, args };
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
      if (typeof value !== "boolean") {
        throw new Error(`Invalid CLI flag value for ${command.id}: ${name}=${String(value)}`);
      }
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

function validateManifestIdentities(manifest: CliCommandManifest) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.tool)) {
    throw new Error(`Invalid CLI manifest tool selector: ${manifest.tool}`);
  }

  assertUnique(
    manifest.commands.map((command) => command.id),
    `CLI command id in ${manifest.tool}`,
  );

  for (const command of manifest.commands) {
    const cliNames: string[] = [];
    for (const [logicalName, flag] of Object.entries(command.flags ?? {})) {
      if (logicalName.length === 0) {
        throw new Error(`Empty CLI flag key in ${manifest.tool}/${command.id}`);
      }
      if (!/^--[A-Za-z0-9][A-Za-z0-9-]*$/.test(flag.cliName)) {
        throw new Error(`Invalid CLI flag name in ${manifest.tool}/${command.id}: ${flag.cliName}`);
      }
      cliNames.push(flag.cliName);
      if (
        flag.type === "enum" &&
        (flag.values.length === 0 ||
          flag.values.some((value) => value.length === 0) ||
          new Set(flag.values).size !== flag.values.length)
      ) {
        throw new Error(`Invalid enum values for ${manifest.tool}/${command.id}/${logicalName}`);
      }
    }
    assertUnique(cliNames, `CLI flag name in ${manifest.tool}/${command.id}`);
  }
}

function assertUnique(values: readonly string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}
