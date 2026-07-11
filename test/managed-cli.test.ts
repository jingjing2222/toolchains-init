import { describe, expect, it } from "vitest";
import {
  createManagedCliSurface,
  getManagedCliFlagPolicy,
  resolveManagedCliPlans,
} from "../src/core/managed-cli";
import type { CliCommandManifest, CliFlagContract } from "../src/core/cli-command-manifest";
import { defineCliCommandManifest } from "../src/core/cli-command-manifest";
import type { ManagedCliUserFlags } from "../src/core/managed-cli";
import type { ToolchainAdapter } from "../src/core/toolchain-adapter";
import type { ManagedToolchainCli } from "../src/core/toolchain-adapter";
import { defineToolchain } from "../src/core/toolchain-adapter";
import type { ToolchainOptions } from "../src/core/types";

const defaultFlags = {
  color: { cliName: "--color", supported: true, type: "string" },
  dangerous: { cliName: "--dangerous", supported: true, type: "boolean" },
  force: { cliName: "--force", supported: true, type: "boolean" },
  help: { cliName: "--help", supported: true, type: "boolean" },
  lang: {
    cliName: "--lang",
    supported: true,
    type: "enum",
    values: ["js", "TypeScript"],
  },
  name: { cliName: "--name", supported: true, type: "string" },
  quiet: { cliName: "--quiet", supported: true, type: "boolean" },
  unsupported: { cliName: "--unsupported", supported: false, type: "boolean" },
  version: { cliName: "--version", supported: true, type: "boolean" },
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
        interactive: true,
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
  commandId = "init",
  feature = "widget",
  managedCli = { phase: "run" },
  selector = "widget",
}: {
  commandId?: string;
  feature?: string;
  managedCli?: ManagedToolchainCli | null;
  selector?: string;
} = {}): ToolchainAdapter {
  return defineToolchain({
    command: commandId,
    commandId,
    feature,
    label: feature,
    managedCli: managedCli ?? undefined,
    package: "create-widget",
    tool: selector,
  });
}

function createOptions(features: string[] = ["widget"]): ToolchainOptions {
  return { features, routerMode: "file" };
}

function resolve(
  adapter: ToolchainAdapter,
  manifest: CliCommandManifest,
  userFlags: ManagedCliUserFlags = {},
  options = createOptions([adapter.feature]),
) {
  return resolveManagedCliPlans({
    manifests: [manifest],
    options,
    packageManager: "npm",
    selectedToolchains: [adapter],
    userFlags,
    yes: true,
  });
}

describe("managed CLI surface", () => {
  it("derives every supported public option from the generated command contract", () => {
    const adapter = createAdapter();
    const manifest = createManifest();

    const surface = createManagedCliSurface([adapter], [manifest]);
    const group = surface.bySelector.get("widget");

    expect(group?.flags.map((flag) => flag.optionName)).toContain("widget.color");
    expect(surface.byOptionName.get("widget.color")).toMatchObject({
      cliName: "--color",
      logicalName: "color",
    });
    expect(surface.byOptionName.has("widget.unsupported")).toBe(false);
  });

  it("keeps unmanaged selectors but does not expose their generated flags", () => {
    const adapter = createAdapter({ managedCli: null });
    const surface = createManagedCliSurface([adapter], [createManifest()]);

    expect(surface.bySelector.get("widget")?.flags).toEqual([]);
    expect(surface.byOptionName.size).toBe(0);
  });

  it("derives wrapper setup options in a collision-proof namespace", () => {
    const adapter = createAdapter({
      managedCli: {
        phase: "run",
        setup: {
          mode: {
            description: "Choose the wrapper mode.",
            option: "routerMode",
            type: "enum",
            values: ["file", "code"],
          },
        },
      },
    });
    const surface = createManagedCliSurface([adapter], [createManifest()]);

    expect(surface.bySetupOptionName.get("widget.setup.mode")).toMatchObject({
      logicalName: "mode",
      optionName: "widget.setup.mode",
    });
    expect(surface.byOptionName.has("widget.mode")).toBe(false);
  });

  it("rejects duplicate, reserved, or ambiguous selectors and identities", () => {
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
    expect(() => createManagedCliSurface([createAdapter()], [manifest, manifest])).toThrow(
      "Duplicate CLI manifest selector: widget",
    );
    expect(() =>
      createManagedCliSurface(
        [createAdapter(), createAdapter({ feature: "widget", selector: "second-widget" })],
        [manifest, createManifest("second-widget")],
      ),
    ).toThrow("Duplicate toolchain feature: widget");
  });

  it("rejects a duplicate reverse CLI-name mapping", () => {
    const manifest = createManifest();
    const duplicateNames: CliCommandManifest = {
      ...manifest,
      commands: [
        {
          ...manifest.commands[0]!,
          flags: {
            first: { cliName: "--same", supported: true, type: "boolean" },
            second: { cliName: "--same", supported: false, type: "string" },
          },
        },
      ],
    };

    expect(() => createManagedCliSurface([createAdapter()], [duplicateNames])).toThrow(
      "Duplicate CLI flag name in widget/init: --same",
    );
  });

  it("requires every CLI-backed selector to have its generated manifest", () => {
    expect(() => createManagedCliSurface([createAdapter()], [])).toThrow(
      "CLI adapter widget has no generated manifest",
    );
  });
});

describe("managed CLI plan resolution", () => {
  it("merges defaults, user values, and locks and puts positionals before generated flags", () => {
    const adapter = createAdapter({
      managedCli: {
        defaults: ({ options, yes }) => ({
          lang: yes ? "TypeScript" : "js",
          name: options.routerMode,
        }),
        locked: ({ packageManager }) => ({ force: packageManager === "npm" }),
        phase: "afterInstall",
        positionals: ({ packageManager }) => ["./public", packageManager],
      },
    });

    const plans = resolve(adapter, createManifest(), {
      widget: { color: "blue", lang: "js" },
    });

    expect(plans.get("widget")).toEqual({
      command: {
        args: [
          "create-widget@1.2.3",
          "init",
          "./public",
          "npm",
          "--lang",
          "js",
          "--name",
          "file",
          "--color",
          "blue",
          "--force",
        ],
        bin: "npx",
      },
      feature: "widget",
      phase: "afterInstall",
      selector: "widget",
    });
  });

  it("treats a false locked value as present and rejects only conflicts", () => {
    const adapter = createAdapter({
      managedCli: { locked: { quiet: false }, phase: "run" },
    });
    const manifest = createManifest();
    const group = createManagedCliSurface([adapter], [manifest]).groups[0];
    const quiet = group?.flags.find((flag) => flag.logicalName === "quiet");
    if (group == null || quiet == null) {
      throw new Error("Missing synthetic quiet flag");
    }

    expect(
      getManagedCliFlagPolicy(group, quiet, {
        options: createOptions(),
        packageManager: "npm",
        yes: true,
      }).lockedValue,
    ).toBe(false);
    expect(() => resolve(adapter, manifest, { widget: { quiet: true } })).toThrow(
      "locked to false",
    );
    expect(
      resolve(adapter, manifest, { widget: { quiet: false } }).get("widget")?.command.args,
    ).not.toContain("--quiet");
  });

  it("rejects adapter policy keys removed from the generated manifest", () => {
    const manifest = createManifest();
    const policies: ManagedToolchainCli[] = [
      { defaults: { removed: true }, phase: "run" },
      { locked: { removed: true }, phase: "run" },
      { blocked: { removed: "removed upstream" }, phase: "run" },
    ];

    for (const managedCli of policies) {
      expect(() => resolve(createAdapter({ managedCli }), manifest)).toThrow(
        "flag no longer exists in widget/init: removed",
      );
    }
  });

  it("rejects blocked user arguments and universally unsafe help/version policies", () => {
    const manifest = createManifest();
    const blocked = createAdapter({
      managedCli: {
        blocked: { dangerous: "unsafe in managed setup" },
        phase: "run",
      },
    });

    expect(() => resolve(blocked, manifest, { widget: { dangerous: false } })).toThrow(
      "unsafe in managed setup",
    );
    expect(() => resolve(blocked, manifest, { widget: { help: true } })).toThrow(
      "Option --widget.help is blocked",
    );
    expect(() =>
      resolve(createAdapter({ managedCli: { defaults: { help: false }, phase: "run" } }), manifest),
    ).toThrow("universally blocked option --widget.help");
    expect(() =>
      resolve(createAdapter({ managedCli: { locked: { version: true }, phase: "run" } }), manifest),
    ).toThrow("universally blocked option --widget.version");
  });

  it("delegates enum and primitive value validation to the generated contract", () => {
    const adapter = createAdapter();
    const manifest = createManifest();

    expect(() => resolve(adapter, manifest, { widget: { lang: "rust" } })).toThrow(
      "Invalid CLI flag value for init: lang=rust",
    );
    expect(() => resolve(adapter, manifest, { widget: { name: true } })).toThrow(
      "Invalid CLI flag value for init: name=true",
    );
    expect(() => resolve(adapter, manifest, { widget: { quiet: "yes" } })).toThrow(
      "Invalid CLI flag value for init: quiet=yes",
    );
  });

  it("rejects unknown, unselected, and unmanaged user flag groups", () => {
    const adapter = createAdapter();
    const manifest = createManifest();

    expect(() => resolve(adapter, manifest, { widget: { missing: true } })).toThrow(
      "Unknown managed CLI flag for --widget: missing",
    );
    expect(() => resolve(adapter, manifest, { other: { quiet: true } })).toThrow(
      "unselected toolchain: other",
    );
    expect(() =>
      resolve(createAdapter({ managedCli: null }), manifest, { widget: { quiet: true } }),
    ).toThrow("does not run a managed initializer");
  });

  it("rejects selection state that disagrees with the policy context", () => {
    const adapter = createAdapter();

    expect(() => resolve(adapter, createManifest(), {}, createOptions(["other"]))).toThrow(
      "Selected toolchains do not match options.features",
    );
  });
});
