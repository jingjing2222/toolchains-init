import type { CliCommandContract, CliManifestSource } from "./cli-command-manifest";

export type CliCommandProbe = {
  exportName: string;
  manifestPath: URL;
  tool: string;
  package: string;
  distTag: string;
  helpCommand?: readonly string[];
  docs?: readonly Extract<CliManifestSource, { kind: "docs" }>[];
  commands: readonly CliCommandContract[];
};

export function defineCliCommandProbe(probe: CliCommandProbe) {
  return probe;
}
