import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { getToolchainCliTool } from "../src/core/toolchain-adapter";
import { toolchains } from "../src/stacks";

const cliPath = path.resolve("dist/cli.mjs");

describe("toolchains-init CLI", () => {
  it("prints the wrapper version", async () => {
    const result = spawnSync(process.execPath, [cliPath, "--version"], { encoding: "utf8" });
    const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8")) as {
      version: string;
    };

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  });

  it("prints wrapper and focused origin help", () => {
    const help = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8" });
    const focused = spawnSync(process.execPath, [cliPath, "--playwright", "--help"], {
      encoding: "utf8",
    });

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("--<tool>.raw.arg <value>");
    expect(help.stdout).not.toContain("--no-install");
    expect(focused.status).toBe(0);
    expect(focused.stdout).toContain("--playwright.browser  forwards --browser");
    expect(focused.stdout).toContain("--playwright.help");
    expect(focused.stdout).toContain("--playwright.raw.arg");
  });

  it("lists every generated origin selector", () => {
    const result = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    for (const toolchain of toolchains) {
      expect(result.stdout).toContain(`--${getToolchainCliTool(toolchain)}`);
    }
  });

  it("forwards raw origin help in an empty working directory and leaves it untouched", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-terminal-"));
    const result = spawnSync(
      process.execPath,
      [cliPath, "--cspell", "--cspell.raw.arg=--help", "--yes"],
      { cwd, encoding: "utf8" },
    );

    expect(result.status, cliOutput(result)).toBe(0);
    expect(cliOutput(result)).toContain("Usage: cspell init");
    expect(await directoryEntries(cwd)).toEqual([]);
  }, 30_000);

  it("does not rewrite project state after origin CLI help exits", async () => {
    const cwd = await createProject();
    const packageJsonPath = path.join(cwd, "package.json");
    const before = await readFile(packageJsonPath, "utf8");
    const result = spawnSync(process.execPath, [cliPath, "--cspell", "--cspell.help", "--yes"], {
      cwd,
      encoding: "utf8",
    });

    expect(result.status, cliOutput(result)).toBe(0);
    expect(await readFile(packageJsonPath, "utf8")).toBe(before);
  }, 30_000);

  it("requires explicit selectors for wrapper --yes", async () => {
    const cwd = await createProject();
    const result = spawnSync(process.execPath, [cliPath, "--yes"], { cwd, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(cliOutput(result)).toContain("requires at least one direct --<tool> selector");
  });

  it("rejects unknown and removed wrapper options before origin execution", async () => {
    const cwd = await createProject();

    for (const args of [["--does-not-exist"], ["--no-install"], ["init"]]) {
      const result = spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(cliOutput(result)).toMatch(/unknown/i);
    }
  });
});

async function createProject() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "toolchains-init-cli-"));
  await writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, version: "0.0.0" }, null, 2)}\n`,
  );
  return cwd;
}

async function directoryEntries(cwd: string) {
  const { readdir } = await import("node:fs/promises");
  return readdir(cwd);
}

function cliOutput(result: { stderr?: string | null; stdout?: string | null }) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}
