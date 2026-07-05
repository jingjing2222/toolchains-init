import { describe, expect, it } from "vitest";
import { renderInitTest } from "../scripts/new-toolchain";

describe("new toolchain scaffolding", () => {
  it("renders a co-located adapter init test template", () => {
    const source = renderInitTest({
      adapterExportName: "hotUpdater",
      catalog: "app",
      command: "init",
      feature: "hotUpdater",
      help: true,
      label: "Hot Updater",
      manifestExportName: "hotUpdaterCliManifest",
      packageName: "hot-updater",
      stackDir: "hot-updater",
    });

    expect(source).toContain('describe("Hot Updater adapter init"');
    expect(source).toContain('} from "../init-test-utils";');
    expect(source).toContain('const toolchainOptions = options(["hotUpdater"]);');
    expect(source).toContain('await runExternalToolchains(cwd, "npm", toolchainOptions, true);');
    expect(source).toContain("await writeToolchain(cwd, packageJson, toolchainOptions);");
    expect(source).toContain('await runPostInstallToolchains(cwd, "npm", toolchainOptions, true);');
    expect(source).toContain("it.skip(");
    expect(source).toContain("TODO: replace with files, package entries, or config");
  });
});
