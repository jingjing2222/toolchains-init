import type { BuiltInFeature } from "../stacks/toolchains.generated";

export type Feature = BuiltInFeature | (string & {});

export type ToolchainOptions = {
  features: Feature[];
};
