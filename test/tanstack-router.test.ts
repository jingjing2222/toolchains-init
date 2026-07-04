import { describe, expect, it } from "vitest";
import { mergeDependencyChanges } from "../src/stacks/tanstack-router";

describe("TanStack Router stack", () => {
  it("keeps package.json changes scoped to added dependencies", () => {
    const merged = mergeDependencyChanges(
      {
        name: "app",
        packageManager: "yarn@4.17.0",
        imports: {
          "#/*": "./src/*",
        },
        scripts: {
          dev: "vite dev",
          build: "vite build",
        },
        dependencies: {
          "@tanstack/router-plugin": "^1.132.0",
          "@toss/tds-mobile": "latest",
          react: "^19.0.0",
        },
        devDependencies: {
          "@vitejs/plugin-react": "^5.0.0",
          eslint: "^9.0.0",
          vite: "^7.0.0",
        },
      },
      {
        name: "tanstack-app",
        packageManager: "npm@11.0.0",
        imports: {
          "@/*": "./src/*",
        },
        scripts: {
          dev: "vinxi dev",
          "generate-routes": "tsr generate",
        },
        dependencies: {
          "@tanstack/react-router": "latest",
          react: "^19.2.0",
        },
        devDependencies: {
          "@tanstack/router-cli": "latest",
          "@tanstack/router-plugin": "latest",
          "@vitejs/plugin-react": "^6.0.0",
          vite: "^8.0.0",
        },
      },
    );

    expect(merged).toEqual({
      name: "app",
      packageManager: "yarn@4.17.0",
      imports: {
        "#/*": "./src/*",
      },
      scripts: {
        dev: "vite dev",
        build: "vite build",
      },
      dependencies: {
        "@tanstack/react-router": "latest",
        "@tanstack/router-plugin": "^1.132.0",
        "@toss/tds-mobile": "latest",
        react: "^19.0.0",
      },
      devDependencies: {
        "@tanstack/router-cli": "latest",
        "@tanstack/router-plugin": "latest",
        "@vitejs/plugin-react": "^5.0.0",
        eslint: "^9.0.0",
        vite: "^7.0.0",
      },
    });
  });
});
