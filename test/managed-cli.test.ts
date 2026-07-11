import { describe, expect, it } from "vitest";
import { defineCliCommandManifest, resolveCliCommand } from "../src/core/cli-command-manifest";
import type { CliCommandManifest, CliFlagContract } from "../src/core/cli-command-manifest";
import { createManagedCliSurface, resolveManagedCliPlans } from "../src/core/managed-cli";
import type { ManagedCliUserArgs } from "../src/core/managed-cli";
import { defineToolchain } from "../src/core/toolchain-adapter";
import type { ToolchainAdapter } from "../src/core/toolchain-adapter";
import { toolchains } from "../src/stacks";

const defaultFlags = {
  cwd: { cliName: "--cwd" },
  help: { cliName: "--help" },
  mode: { cliName: "--mode" },
  stdout: { cliName: "--stdout" },
  version: { cliName: "--version" },
} satisfies Record<string, CliFlagContract>;

function createManifest(
  tool = "widget",
  flags: Record<string, CliFlagContract> = defaultFlags,
): CliCommandManifest {
  return defineCliCommandManifest({
    commands: [
      {
        flags,
        id: "init",
        packageManagers: {
          npm: ["npx", "create-widget@{version}", "init"],
          pnpm: ["pnpm", "dlx", "create-widget@{version}", "init"],
        },
      },
    ],
    package: "create-widget",
    schemaVersion: "toolchains-init/cli-command-manifest/v1",
    sources: [],
    tool,
    version: "1.2.3",
  });
}

function createAdapter({
  feature = "widget",
  managedCli = true,
  selector = "widget",
}: {
  feature?: string;
  managedCli?: true | null;
  selector?: string;
} = {}): ToolchainAdapter {
  return defineToolchain({
    command: "init",
    feature,
    label: feature,
    managedCli: managedCli ?? undefined,
    package: "create-widget",
    tool: selector,
  });
}

function resolve(
  adapter: ToolchainAdapter,
  manifest: CliCommandManifest,
  userArgs: ManagedCliUserArgs = {},
) {
  return resolveManagedCliPlans({
    manifests: [manifest],
    packageManager: "npm",
    selectedToolchains: [adapter],
    userArgs,
  });
}

describe("managed CLI surface", () => {
  it("derives discovered flag names and a collision-proof raw argument option", () => {
    const surface = createManagedCliSurface([createAdapter()], [createManifest()]);
    const group = surface.bySelector.get("widget");

    expect(group?.flags.map((flag) => flag.optionName)).toEqual([
      "widget.cwd",
      "widget.help",
      "widget.mode",
      "widget.stdout",
      "widget.version",
    ]);
    expect(group?.rawArgOptionName).toBe("widget.raw.arg");
  });

  it("keeps unmanaged selectors without exposing origin arguments", () => {
    const surface = createManagedCliSurface(
      [createAdapter({ managedCli: null })],
      [createManifest()],
    );
    const group = surface.bySelector.get("widget");

    expect(group?.flags).toEqual([]);
    expect(group?.rawArgOptionName).toBeNull();
  });

  it("rejects duplicate, reserved, or missing manifest identities", () => {
    const manifest = createManifest();

    expect(() =>
      createManagedCliSurface(
        [createAdapter(), createAdapter({ feature: "other", selector: "widget" })],
        [manifest],
      ),
    ).toThrow("Duplicate direct CLI selector: widget");
    expect(() => createManagedCliSurface([createAdapter({ selector: "help" })], [])).toThrow(
      "Direct CLI selector is reserved: help",
    );
    expect(() => createManagedCliSurface([createAdapter()], [])).toThrow(
      "CLI adapter widget has no generated manifest",
    );
  });
});

describe("managed CLI plan resolution", () => {
  it("resolves the untouched generated command when the user supplies no arguments", () => {
    const adapter = createAdapter();
    const manifest = createManifest();

    expect(resolve(adapter, manifest).get("widget")?.command).toEqual(
      resolveCliCommand(manifest, "init", "npm"),
    );
  });

  it("forwards origin arguments exactly without wrapper policy", () => {
    const args = [
      "--cwd=../elsewhere",
      "--help",
      "--mode",
      "unknown",
      "--stdout",
      "--version",
      "--new-upstream-flag",
    ];
    const plan = resolve(createAdapter(), createManifest(), { widget: args }).get("widget");

    expect(plan?.command.args).toEqual(["create-widget@1.2.3", "init", ...args]);
  });

  it("appends raw positionals, repeated flags, and the option terminator exactly", () => {
    const rawArgs = ["--preview-feature", "one", "--preview-feature", "two", "--", "file.ts"];
    const plan = resolve(createAdapter(), createManifest(), { widget: rawArgs }).get("widget");

    expect(plan?.command.args.slice(-rawArgs.length)).toEqual(rawArgs);
  });

  it("rejects unselected and unmanaged argument groups", () => {
    const adapter = createAdapter();
    const manifest = createManifest();

    expect(() => resolve(adapter, manifest, { other: ["--help"] })).toThrow("unselected toolchain");
    expect(() =>
      resolve(createAdapter({ managedCli: null }), manifest, { widget: ["file"] }),
    ).toThrow("does not run a managed CLI command");
  });

  it("keeps every registered CLI adapter on the transparent terminal runner", () => {
    for (const toolchain of toolchains) {
      expect(toolchain.managedCli, toolchain.feature).toBe(true);
      expect(toolchain).not.toHaveProperty("afterInstall");
      expect(toolchain).not.toHaveProperty("afterWrite");
      expect(toolchain).not.toHaveProperty("beforeRun");
      expect(toolchain).not.toHaveProperty("blocked");
      expect(toolchain).not.toHaveProperty("defaults");
      expect(toolchain).not.toHaveProperty("execute");
      expect(toolchain).not.toHaveProperty("locked");
      expect(toolchain).not.toHaveProperty("targetFiles");
      expect(toolchain).not.toHaveProperty("updatePackageJson");
    }
  });
});
