import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeOxlintConfig } from "../src/stacks/oxlint";

describe("oxlint stack", () => {
  it("removes node_modules schema for PnP projects", async () => {
    const cwd = await createProject();

    await normalizeOxlintConfig(cwd, true);

    expect(await readConfig(cwd)).not.toHaveProperty("$schema");
  });

  it("keeps node_modules schema outside PnP projects", async () => {
    const cwd = await createProject();

    await normalizeOxlintConfig(cwd, false);

    expect((await readConfig(cwd)).$schema).toBe("./node_modules/oxlint/configuration_schema.json");
  });
});

async function createProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-oxlint-"));
  await mkdir(cwd, { recursive: true });
  await writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ private: true, workspaces: ["packages/*"] }, null, 2)}\n`,
  );
  await writeConfig(cwd);
  return cwd;
}

async function readConfig(cwd: string) {
  return JSON.parse(await readFile(path.join(cwd, ".oxlintrc.json"), "utf8")) as Record<
    string,
    unknown
  >;
}

async function writeConfig(cwd: string) {
  await writeFile(
    path.join(cwd, ".oxlintrc.json"),
    `${JSON.stringify(
      {
        $schema: "./node_modules/oxlint/configuration_schema.json",
        rules: {},
      },
      null,
      2,
    )}\n`,
  );
}
