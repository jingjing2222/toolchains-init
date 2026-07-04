import { biome } from "./biome";
import { changesets } from "./changesets";
import { knip } from "./knip";
import { oxfmt } from "./oxfmt";
import { oxlint } from "./oxlint";
import { playwright } from "./playwright";
import { reactDoctor } from "./react-doctor";
import { tanStackRouter } from "./tanstack-router";
import { yarnSdks } from "./yarn-sdks";

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
