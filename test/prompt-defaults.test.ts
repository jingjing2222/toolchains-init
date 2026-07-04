import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolchainAdapter } from "../src/core/toolchain-adapter";

const multiselect = vi.fn(() => ["oxlint"]);

vi.mock("@clack/prompts", () => ({
  cancel: vi.fn(),
  confirm: vi.fn(),
  intro: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
  multiselect,
  outro: vi.fn(),
  select: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

describe("prompt defaults", () => {
  beforeEach(() => {
    multiselect.mockClear();
  });

  it("does not preselect toolchains in the interactive prompt", async () => {
    const { selectFeatures } = await import("../src/commands/init");

    await selectFeatures([toolchain("oxlint", "oxlint"), toolchain("yarnSdks", "Yarn SDKs")]);

    expect(multiselect).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValues: [],
      }),
    );
  });
});

function toolchain(feature: ToolchainAdapter["feature"], label: string): ToolchainAdapter {
  return {
    feature,
    label,
    hint: label,
  };
}
