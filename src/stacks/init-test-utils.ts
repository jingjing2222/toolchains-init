import type { ToolchainOptions } from "../core/types";

export function options(features: ToolchainOptions["features"]): ToolchainOptions {
  return { features };
}
