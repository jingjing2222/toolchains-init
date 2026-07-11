import { describe, expect, it } from "vitest";
import { getSelectedToolchains, toolchains } from "../src/stacks";

describe("toolchain registry", () => {
  it("lets origin CLIs decide project compatibility", () => {
    for (const toolchain of toolchains) {
      expect(toolchain).not.toHaveProperty("isAvailable");
      expect(toolchain).not.toHaveProperty("nonInteractive");
      expect(toolchain.managedCli).toBe(true);
    }
  });

  it("does not guess package-manager compatibility before origin execution", () => {
    for (const toolchain of toolchains) {
      expect(toolchain.cli?.packageManagers, toolchain.feature).toBeUndefined();
    }
  });

  it("keeps the user's selected origin command order", () => {
    expect(
      getSelectedToolchains(["yarnSdks", "cspell", "router"]).map((toolchain) => toolchain.feature),
    ).toEqual(["yarnSdks", "cspell", "router"]);
  });
});
