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

const cliFlagContractSchema = v.object({
  cliName: v.string(),
});

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
  userArgs: readonly string[] = [],
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
    ...userArgs,
  ];
  const [bin, ...args] = tokens;
  if (bin == null) {
    throw new Error(`CLI command contract ${manifest.tool}/${commandId} has no binary`);
  }

  return { bin, args };
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
