import type { CliCommandManifest } from "../core/cli-command-manifest";
import { biome, biomeCliManifest } from "./biome";
import { changesets, changesetsCliManifest } from "./changesets";
import { knip, knipCliManifest } from "./knip";
import { oxfmt, oxfmtCliManifest } from "./oxfmt";
import { oxlint, oxlintCliManifest } from "./oxlint";
import { playwright, playwrightCliManifest } from "./playwright";
import { reactDoctor, reactDoctorCliManifest } from "./react-doctor";
import { tanStackRouter, tanStackRouterCliManifest } from "./tanstack-router";
import { yarnSdks, yarnSdksCliManifest } from "./yarn-sdks";

export const toolchains = [
  tanStackRouter,
  playwright,
  oxfmt,
  oxlint,
  biome,
  knip,
  reactDoctor,
  changesets,
  yarnSdks,
];

export const ALL_FEATURES = toolchains.map((toolchain) => toolchain.feature);

export const cliCommandManifests = [
  tanStackRouterCliManifest,
  playwrightCliManifest,
  oxfmtCliManifest,
  oxlintCliManifest,
  biomeCliManifest,
  knipCliManifest,
  reactDoctorCliManifest,
  changesetsCliManifest,
  yarnSdksCliManifest,
] satisfies readonly CliCommandManifest[];

export function getCliCommandManifest(tool: string) {
  return cliCommandManifests.find((manifest) => manifest.tool === tool) ?? null;
}

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
