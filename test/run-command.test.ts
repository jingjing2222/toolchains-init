import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCommandEnvironment } from "../src/core/run-command";

describe("run command environment", () => {
  it("strips parent Yarn PnP preload outside the PnP project", () => {
    const root = path.resolve("/repo");
    const env = createCommandEnvironment("/tmp/app", {
      NODE_OPTIONS: `--require ${root}/.pnp.cjs --experimental-loader ${root}/.pnp.loader.mjs --trace-warnings`,
      npm_config_user_agent: "yarn/4.17.0 npm/? node/v24.18.0 darwin arm64",
    });

    expect(env.NODE_OPTIONS).toBe("--trace-warnings");
    expect(env.npm_config_user_agent).toBeUndefined();
  });

  it("keeps Yarn PnP preload inside the PnP project", () => {
    const root = path.resolve("/repo");
    const nodeOptions = `--require ${root}/.pnp.cjs`;
    const env = createCommandEnvironment(`${root}/apps/web`, {
      NODE_OPTIONS: nodeOptions,
    });

    expect(env.NODE_OPTIONS).toBe(nodeOptions);
  });

  it("keeps package manager user agent inside the PnP project", () => {
    const root = path.resolve("/repo");
    const userAgent = "yarn/4.17.0 npm/? node/v24.18.0 darwin arm64";
    const env = createCommandEnvironment(`${root}/apps/web`, {
      NODE_OPTIONS: `--experimental-loader=${root}/.pnp.loader.mjs`,
      npm_config_user_agent: userAgent,
    });

    expect(env.npm_config_user_agent).toBe(userAgent);
  });

  it("removes NODE_OPTIONS when only the stale PnP preload exists", () => {
    const root = path.resolve("/repo");
    const env = createCommandEnvironment("/tmp/app", {
      NODE_OPTIONS: `--require=${root}/.pnp.cjs`,
    });

    expect(env.NODE_OPTIONS).toBeUndefined();
  });
});
