import { describe, expect, it } from "vitest";
import { updatePackageJson } from "../src/core/package-json";
import type { PackageJson } from "../src/core/types";

describe("package.json updates", () => {
  it("adds only the selected quality tools", () => {
    const updated = updatePackageJson(basePackageJson(), ["oxfmt", "oxlint", "knip"]);

    expect(updated.scripts?.format).toBeUndefined();
    expect(updated.scripts?.["format:check"]).toBeUndefined();
    expect(updated.scripts?.lint).toBeUndefined();
    expect(updated.scripts?.knip).toBe("npx knip");
    expect(updated.scripts?.["react-doctor"]).toBeUndefined();
    expect(updated.scripts?.verify).toBeUndefined();
    expect(updated.devDependencies?.oxfmt).toBe("^0.57.0");
    expect(updated.devDependencies?.oxlint).toBe("^1.72.0");
    expect(updated.devDependencies?.knip).toBeUndefined();
    expect(updated.devDependencies?.["react-doctor"]).toBeUndefined();
  });

  it("leaves router dependencies to the official TanStack CLI", () => {
    const updated = updatePackageJson(basePackageJson(), ["router"]);

    expect(updated.dependencies?.["@tanstack/react-router"]).toBeUndefined();
    expect(updated.devDependencies?.["@tanstack/router-plugin"]).toBeUndefined();
  });

  it("does not remove legacy formatter and linter dependencies", () => {
    const updated = updatePackageJson(
      {
        ...basePackageJson(),
        scripts: {
          format: "prettier --write .",
          lint: "eslint .",
        },
        devDependencies: {
          "@biomejs/biome": "^1.9.4",
          eslint: "^9.0.0",
          prettier: "^3.0.0",
        },
      },
      ["oxfmt", "oxlint"],
    );

    expect(updated.scripts?.format).toBe("prettier --write .");
    expect(updated.scripts?.lint).toBe("eslint .");
    expect(updated.devDependencies?.["@biomejs/biome"]).toBe("^1.9.4");
    expect(updated.devDependencies?.eslint).toBe("^9.0.0");
    expect(updated.devDependencies?.prettier).toBe("^3.0.0");
  });

  it("keeps legacy formatter and linter scripts when oxfmt and oxlint are not selected", () => {
    const updated = updatePackageJson(
      {
        ...basePackageJson(),
        scripts: {
          format: "prettier --write .",
          lint: "eslint .",
        },
        devDependencies: {
          eslint: "^9.0.0",
          prettier: "^3.0.0",
        },
      },
      ["reactDoctor"],
    );

    expect(updated.scripts?.format).toBe("prettier --write .");
    expect(updated.scripts?.lint).toBe("eslint .");
    expect(updated.devDependencies?.eslint).toBe("^9.0.0");
    expect(updated.devDependencies?.prettier).toBe("^3.0.0");
  });

  it("runs React Doctor through npx without installing it", () => {
    const updated = updatePackageJson(basePackageJson(), ["reactDoctor"]);

    expect(updated.scripts?.["react-doctor"]).toBe("npx react-doctor@latest");
    expect(updated.scripts?.verify).toBeUndefined();
    expect(updated.devDependencies?.["react-doctor"]).toBeUndefined();
  });

  it("runs Knip through npx without installing it", () => {
    const updated = updatePackageJson(basePackageJson(), ["knip"]);

    expect(updated.scripts?.knip).toBe("npx knip");
    expect(updated.devDependencies?.knip).toBeUndefined();
  });

  it("sets up Changesets scripts and dependency", () => {
    const updated = updatePackageJson(basePackageJson(), ["changesets"]);

    expect(updated.scripts?.changeset).toBeUndefined();
    expect(updated.scripts?.["version-packages"]).toBeUndefined();
    expect(updated.scripts?.release).toBeUndefined();
    expect(updated.devDependencies?.["@changesets/cli"]).toBe("^2.31.0");
  });

  it("sets up Biome as an exact dev dependency", () => {
    const updated = updatePackageJson(basePackageJson(), ["biome"]);

    expect(updated.devDependencies?.["@biomejs/biome"]).toBe("2.5.2");
    expect(updated.scripts?.format).toBeUndefined();
    expect(updated.scripts?.lint).toBeUndefined();
  });
});

function basePackageJson(): PackageJson {
  return {
    scripts: {},
    dependencies: {},
    devDependencies: {},
  };
}
