import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getCliCommandManifest, toolchains } from "../src/stacks";

const cliPath = path.resolve("dist/cli.mjs");
const retainedToolIds = [
  "hot-updater",
  "prisma",
  "shadcn",
  "supabase",
  "playwright",
  "storybook",
  "oxfmt",
  "oxlint",
  "eslint",
  "biome",
  "changesets",
  "cspell",
  "secretlint",
  "yarn-sdks",
] as const;
const removedToolIds = [
  "attw",
  "knip",
  "msw",
  "prettier",
  "publint",
  "react-doctor",
  "tanstack-router",
] as const;

describe("toolchains-init CLI", () => {
  it("prints the wrapper version", async () => {
    const result = runCli(["--version"]);
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
      version: string;
    };

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  it("prints wrapper and focused origin help", () => {
    const help = runCli(["--help"]);
    const focused = runCli(["--playwright", "--help"]);

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("--<tool>.raw.arg <value>");
    expect(help.stdout).toContain("--plan");
    expect(help.stdout).not.toMatch(/-y,\s+--yes/);
    expect(focused.status).toBe(0);
    expect(focused.stdout).toContain("--playwright.browser  forwards --browser");
    expect(focused.stdout).toContain("--playwright.help");
    expect(focused.stdout).toContain("--playwright.raw.arg");
  });

  it("lists exactly the retained initializer selectors", () => {
    const result = runCli(["--help"]);

    expect(result.status).toBe(0);
    expect(toolchains.map((toolchain) => toolchain.id)).toEqual(retainedToolIds);
    for (const id of retainedToolIds) {
      expect(result.stdout).toContain(`--${id}`);
    }
    for (const id of removedToolIds) {
      expect(result.stdout).not.toContain(`--${id}`);
    }
  });

  it("prints an exact side-effect-free plan without running the origin CLI", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-plan-"));
    const manifest = getCliCommandManifest("cspell");
    if (manifest == null) {
      throw new Error("Missing CSpell manifest");
    }

    const result = runCli(["--cspell", "--plan", "--package-manager", "npm"], cwd);

    expect(result.status, cliOutput(result)).toBe(0);
    expect(result.stdout).toContain(`Target: ${await realpath(cwd)}`);
    expect(result.stdout).toContain("Package manager: npm");
    expect(result.stdout).toContain(`Package: cspell@${manifest.version}`);
    expect(result.stdout).toContain("Exec: npx");
    expect(result.stdout).toContain(`Args: ["cspell@${manifest.version}","init"]`);
    expect(result.stdout).toContain(
      "Source: https://raw.githubusercontent.com/streetsidesoftware/cspell/main/packages/cspell/src/commandInit.ts",
    );
    expect(result.stdout).toContain("Plan complete. No commands were run.");
    expect(await readdir(cwd)).toEqual([]);
  });

  it("forwards raw origin help directly and leaves an empty directory untouched", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-terminal-"));
    const result = runCli(["--cspell", "--cspell.raw.arg=--help"], cwd);

    expect(result.status, cliOutput(result)).toBe(0);
    expect(cliOutput(result)).toContain("Usage: cspell init");
    expect(await readdir(cwd)).toEqual([]);
  }, 30_000);

  it("does not rewrite project state after origin CLI help exits", async () => {
    const cwd = await createProject();
    const packageJsonPath = path.join(cwd, "package.json");
    const before = await readFile(packageJsonPath, "utf8");
    const result = runCli(["--cspell", "--cspell.help"], cwd);

    expect(result.status, cliOutput(result)).toBe(0);
    expect(await readFile(packageJsonPath, "utf8")).toBe(before);
  }, 30_000);

  it("rejects wrapper --yes and all seven removed selectors", async () => {
    const cwd = await createProject();

    for (const option of ["--yes", ...removedToolIds.map((id) => `--${id}`)]) {
      const result = runCli([option], cwd);
      expect(result.status, option).toBe(1);
      expect(cliOutput(result), option).toMatch(/unknown option/i);
    }
  });

  it("rejects unrelated options and positional compatibility surfaces", async () => {
    const cwd = await createProject();

    for (const args of [["--does-not-exist"], ["--no-install"], ["init"]]) {
      const result = runCli(args, cwd);
      expect(result.status).toBe(1);
      expect(cliOutput(result)).toMatch(/unknown/i);
    }
  });
});

function runCli(args: readonly string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });
}

async function createProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-cli-"));
  await writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, version: "0.0.0" }, null, 2)}\n`,
  );
  return cwd;
}

function cliOutput(result: { stderr?: string | null; stdout?: string | null }) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}
