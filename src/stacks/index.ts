import type { CliCommandManifest } from "../core/cli-command-manifest";
import { biome, biomeCliManifest, biomeCliManifestData } from "./biome/index";
import { changesets, changesetsCliManifest, changesetsCliManifestData } from "./changesets/index";
import { knip, knipCliManifest } from "./knip/index";
import { knipCliManifestData } from "./knip/index";
import { oxfmt, oxfmtCliManifest, oxfmtCliManifestData } from "./oxfmt/index";
import { oxlint, oxlintCliManifest, oxlintCliManifestData } from "./oxlint/index";
import { playwright, playwrightCliManifest, playwrightCliManifestData } from "./playwright/index";
import {
  reactDoctor,
  reactDoctorCliManifest,
  reactDoctorCliManifestData,
} from "./react-doctor/index";
import {
  tanStackRouter,
  tanStackRouterCliManifest,
  tanStackRouterCliManifestData,
} from "./tanstack-router/index";
import { yarnSdks, yarnSdksCliManifest, yarnSdksCliManifestData } from "./yarn-sdks/index";

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

export const cliCommandManifestData = [
  tanStackRouterCliManifestData,
  playwrightCliManifestData,
  oxfmtCliManifestData,
  oxlintCliManifestData,
  biomeCliManifestData,
  knipCliManifestData,
  reactDoctorCliManifestData,
  changesetsCliManifestData,
  yarnSdksCliManifestData,
];

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
