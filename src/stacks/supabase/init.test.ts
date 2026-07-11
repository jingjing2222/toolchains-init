import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { resolveManagedCliPlans } from "../../core/managed-cli";
import { runExternalToolchains } from "../../core/external-toolchains";
import { supabase } from "./adapter";
import { supabaseCliManifest } from "./manifest";
import {
  adapterInitTimeout,
  createFreshViteProject,
  expectFileToExist,
  options,
  readPackageJson,
} from "../init-test-utils";

describe("Supabase adapter init", () => {
  it("declares a fully unattended initializer", () => {
    expect(supabase.managedCli?.phase).toBe("run");
    expect(supabase.managedCli?.blocked).toEqual(expect.any(Function));
    expect(supabase.nonInteractive).toBeUndefined();
  });

  it.each(["completions", "workdir"] as const)(
    "blocks the %s option from bypassing target initialization",
    (flag) => {
      expect(() =>
        resolveManagedCliPlans({
          manifests: [supabaseCliManifest],
          options: options(["supabase"]),
          packageManager: "npm",
          selectedToolchains: [supabase],
          userFlags: {
            supabase: { [flag]: flag === "completions" ? "zsh" : "../other-project" },
          },
          yes: true,
        }),
      ).toThrow(`--supabase.${flag} is blocked`);
    },
  );

  it("allows interactive IDE setup only when stdin is inherited", () => {
    const input = {
      manifests: [supabaseCliManifest],
      options: options(["supabase"]),
      packageManager: "npm" as const,
      selectedToolchains: [supabase],
      userFlags: { supabase: { interactive: true } },
    };

    expect(resolveManagedCliPlans({ ...input, yes: false }).get("supabase")?.command.args).toEqual([
      `supabase@${supabaseCliManifest.version}`,
      "init",
      "--interactive",
    ]);
    expect(() => resolveManagedCliPlans({ ...input, yes: true })).toThrow(
      "--supabase.interactive is blocked",
    );
  });

  it("declares the generated Supabase config as an overwrite target", () => {
    expect(supabase.targetFiles?.(options(["supabase"]))).toEqual(["supabase/config.toml"]);
  });

  it("resolves the plain Supabase init command", () => {
    expect(resolveCliCommand(supabaseCliManifest, "init", "npm")).toEqual({
      bin: "npx",
      args: [`supabase@${supabaseCliManifest.version}`, "init"],
    });
  });

  it(
    "runs Supabase init without stdin and creates its local config",
    async () => {
      const cwd = await createFreshViteProject();
      const packageJson = await readPackageJson(cwd);

      await runExternalToolchains(cwd, "npm", options(["supabase"]), true);

      await expectFileToExist(cwd, "supabase/config.toml");
      expect(await readPackageJson(cwd)).toEqual(packageJson);
    },
    adapterInitTimeout,
  );
});
