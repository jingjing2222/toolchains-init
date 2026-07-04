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

    const toolchains = await getAvailableToolchains({ cwd, packageManager: "yarn" });

    expect(toolchains.map((toolchain) => toolchain.feature)).toContain("yarnSdks");
  });

  it("excludes Yarn SDKs outside Yarn PnP projects", async () => {
    const cwd = await createProject();

    const toolchains = await getAvailableToolchains({ cwd, packageManager: "yarn" });

    expect(toolchains.map((toolchain) => toolchain.feature)).not.toContain("yarnSdks");
  });
});

async function createProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-availability-"));
  await mkdir(cwd, { recursive: true });
  await writeFile(path.join(cwd, "package.json"), '{"private":true}\n');
  return cwd;
}
