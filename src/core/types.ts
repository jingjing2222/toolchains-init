import type { BuiltInFeature } from "../stacks/toolchains.generated";

export type PackageJson = {
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type Feature = BuiltInFeature | (string & {});
export type RouterMode = "code" | "file";

export type ToolchainOptions = {
  features: Feature[];
  routerMode: RouterMode;
};

export const DEFAULT_ROUTER_MODE: RouterMode = "file";
