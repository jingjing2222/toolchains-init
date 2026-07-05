import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getAvailableToolchains } from "../src/stacks";
import { getPnpInfo } from "../src/core/yarn";

describe("toolchain availability", () => {
  it("detects runtime and project PnP through node:module", () => {
    const pnpInfo = getPnpInfo(process.cwd());

    expect(pnpInfo.isRuntimePnp).toBe(true);
    expect(pnpInfo.isProjectPnp).toBe(true);
    expect(pnpInfo.pnpApi).not.toBeNull();
  });

  it("includes Yarn SDKs for Yarn PnP projects", async () => {
    const cwd = process.cwd();

    const toolchains = await getAvailableToolchains({
      cwd,
      packageJson: {},
      packageManager: "yarn",
    });

    expect(toolchains.map((toolchain) => toolchain.feature)).toContain("yarnSdks");
  });

  it("includes Yarn SDKs when Yarn has no nodeLinker override", async () => {
    const cwd = await createProject();

    const toolchains = await getAvailableToolchains({
      cwd,
      packageJson: {},
      packageManager: "yarn",
    });

    expect(toolchains.map((toolchain) => toolchain.feature)).toContain("yarnSdks");
  });

  it("includes Yarn SDKs when nodeLinker is PnP", async () => {
    const cwd = await createProject();
    await writeFile(path.join(cwd, ".yarnrc.yml"), "nodeLinker: pnp\n");

    const toolchains = await getAvailableToolchains({
      cwd,
      packageJson: {},
      packageManager: "yarn",
    });

    expect(toolchains.map((toolchain) => toolchain.feature)).toContain("yarnSdks");
  });

  it("includes Yarn SDKs when PnP artifacts exist in an ancestor directory", async () => {
    const workspace = await createProject();
    await writeFile(path.join(workspace, ".pnp.cjs"), "");
    const cwd = path.join(workspace, "apps", "web");
    await mkdir(cwd, { recursive: true });
    await writeFile(path.join(cwd, "package.json"), '{"private":true}\n');

    const toolchains = await getAvailableToolchains({
      cwd,
      packageJson: {},
      packageManager: "yarn",
    });

    expect(toolchains.map((toolchain) => toolchain.feature)).toContain("yarnSdks");
  });

  it("excludes Yarn SDKs when Yarn uses node_modules", async () => {
    const cwd = await createProject();
    await writeFile(path.join(cwd, ".yarnrc.yml"), "nodeLinker: node-modules\n");

    const toolchains = await getAvailableToolchains({
      cwd,
      packageJson: {},
      packageManager: "yarn",
    });

    expect(toolchains.map((toolchain) => toolchain.feature)).not.toContain("yarnSdks");
  });
});

async function createProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-availability-"));
  await mkdir(cwd, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), '{"private":true}\n');
  return cwd;
}
