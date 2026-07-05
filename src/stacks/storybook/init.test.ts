import { describe, expect, it } from "vitest";
import { resolveCliCommand } from "../../core/cli-command-manifest";
import { createFreshViteProject, options, readPackageJson } from "../init-test-utils";

describe("Storybook adapter init", () => {
  it("is only available for React Vite projects with supported package managers", async () => {
    const cwd = await createFreshViteProject();
    const packageJson = await readPackageJson(cwd);
    const { storybook } = await import("./adapter");

    expect(await storybook.isAvailable?.({ cwd, packageJson, packageManager: "npm" })).toBe(true);
    expect(await storybook.isAvailable?.({ cwd, packageJson, packageManager: "deno" })).toBe(false);
    expect(
      await storybook.isAvailable?.({
        cwd,
        packageJson: { ...packageJson, dependencies: { react: "^18.3.1" } },
        packageManager: "npm",
      }),
    ).toBe(false);
  });

  it("declares Storybook generated files as overwrite targets", async () => {
    const { storybook } = await import("./adapter");

    expect(storybook.targetFiles?.(options(["storybook"]))).toEqual([
      ".storybook/main.ts",
      ".storybook/preview.tsx",
      "src/stories/Button.stories.ts",
      "src/stories/Button.tsx",
      "src/stories/Header.stories.ts",
      "src/stories/Header.tsx",
      "src/stories/Page.stories.ts",
      "src/stories/Page.tsx",
    ]);
  });

  it("resolves a non-interactive React Vite Storybook init command", async () => {
    const { storybookCliManifest } = await import("./manifest");

    expect(
      resolveCliCommand(storybookCliManifest, "init", "npm", {
        builder: "vite",
        disableTelemetry: true,
        loglevel: "warn",
        noAgent: true,
        noDev: true,
        noFeatures: true,
        packageManager: "npm",
        skipInstall: true,
        type: "react",
        yes: true,
      }),
    ).toEqual({
      bin: "npm",
      args: [
        "init",
        `storybook@${storybookCliManifest.version}`,
        "--",
        "--builder",
        "vite",
        "--disable-telemetry",
        "--loglevel",
        "warn",
        "--no-agent",
        "--no-dev",
        "--no-features",
        "--package-manager",
        "npm",
        "--skip-install",
        "--type",
        "react",
        "--yes",
      ],
    });
  });
});
