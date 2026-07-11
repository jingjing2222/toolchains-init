import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { runExternalToolchains } from "../../core/external-toolchains";
import { prisma } from "./adapter";
import { prismaCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Prisma adapter init", () => {
  it("declares a fully unattended initializer", () => {
    expect(prisma.managedCli).toEqual({ phase: "run" });
    expect(prisma.nonInteractive).toBeUndefined();
    expect(prisma.cli?.help).toBe(false);
  });

  it("declares Prisma's generated config files as overwrite targets", () => {
    expect(prisma.targetFiles?.(options(["prisma"]))).toEqual([
      "prisma.config.ts",
      "prisma/schema.prisma",
      ".env",
      ".gitignore",
    ]);
  });

  it("resolves the plain Prisma init command", () => {
    expect(resolveCliCommand(prismaCliManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`prisma@${prismaCliManifest.version}`, "init"],
    });
  });

  it(
    "runs Prisma init without stdin and creates its core config files",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);

      await runExternalToolchains(cwd, "npm", options(["prisma"]), true);

      await expectFileToExist(cwd, "prisma.config.ts");
      await expectFileToExist(cwd, "prisma/schema.prisma");
      await expectFileToExist(cwd, ".env");
      await expectFileToExist(cwd, ".gitignore");
      expect(await readFile(path.join(cwd, ".gitignore"), "utf8")).toContain("/generated/prisma");
      expect(await readPackageJson(cwd)).toEqual(packageJson);
    },
    adapterInitTimeout,
  );
});
