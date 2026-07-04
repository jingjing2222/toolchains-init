import { describe, expect, it } from "vitest";
import { detectPackageManager } from "../src/core/package-manager";

describe("package manager detection", () => {
  it("prefers npm_config_user_agent", () => {
    expect(detectPackageManager({ npm_config_user_agent: "pnpm/10.24.0 node/v24.11.1" })).toBe(
      "pnpm",
    );
    expect(detectPackageManager({ npm_config_user_agent: "npm/11.6.4 node/v24.11.1" })).toBe("npm");
    expect(detectPackageManager({ npm_config_user_agent: "yarn/4.17.0 npm/? node/v24.11.1" })).toBe(
      "yarn",
    );
  });

  it("falls back to npm_execpath", () => {
    expect(detectPackageManager({ npm_execpath: "/opt/homebrew/bin/pnpm" })).toBe("pnpm");
    expect(detectPackageManager({ npm_execpath: "/Users/me/.yarn/releases/yarn-4.17.0.cjs" })).toBe(
      "yarn",
    );
    expect(
      detectPackageManager({ npm_execpath: "/usr/local/lib/node_modules/npm/bin/npm-cli.js" }),
    ).toBe("npm");
  });

  it("uses npm when detection fails", () => {
    expect(detectPackageManager({})).toBe("npm");
  });
});
