import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolchainAdapter } from "../src/core/toolchain-adapter";

const groupMultiselect = vi.fn(() => ["oxlint"]);

vi.mock("@clack/prompts", () => ({
  cancel: vi.fn(),
  confirm: vi.fn(),
  groupMultiselect,
  intro: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
  outro: vi.fn(),
  select: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

describe("prompt defaults", () => {
  beforeEach(() => {
    groupMultiselect.mockClear();
  });

  it("does not preselect toolchains in the interactive prompt", async () => {
    const { selectFeatures } = await import("../src/commands/init");

    await selectFeatures([
      toolchain("router", "TanStack Router", "app"),
      toolchain("oxlint", "oxlint", "quality"),
      toolchain("changesets", "Changesets", "release"),
      toolchain("yarnSdks", "Yarn SDKs", "editor"),
    ]);

    expect(groupMultiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValues: [],
      }),
    );
    expect(groupMultiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          "App Foundation": [expect.objectContaining({ value: "router" })],
          "Quality & Testing": [expect.objectContaining({ value: "oxlint" })],
          Release: [expect.objectContaining({ value: "changesets" })],
          Editor: [expect.objectContaining({ value: "yarnSdks" })],
        },
        selectableGroups: true,
      }),
    );
  });
});

function toolchain(
  feature: ToolchainAdapter["feature"],
  label: string,
  catalog: ToolchainAdapter["catalog"],
): ToolchainAdapter {
  return {
    catalog,
    feature,
    label,
    hint: label,
  };
}
