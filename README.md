# toolchains-init

[![NPM](https://img.shields.io/npm/v/toolchains-init)](https://www.npmjs.com/package/toolchains-init)

Set up the tools you usually add after creating a fresh Vite React app.

`toolchains-init` runs the official initializers for the tools you choose, then applies the small workspace setup those tools expect: editor settings, package scripts, router files, test config, and release tooling.

## Quick Start

Run it from your app directory:

```bash
npx toolchains-init
yarn dlx toolchains-init
pnpm dlx toolchains-init
```

Then choose what you want to add from the interactive prompt.

## Key Features

- **Official setup commands**: runs each tool's own initializer instead of copying a template.
- **Pick only what you need**: router, E2E, formatter, linter, dead-code checks, release tooling, or editor SDKs.
- **Cataloged prompt**: toolchains are grouped by app foundation, quality, release, and editor setup.
- **Fresh app friendly**: designed for newly scaffolded Vite React projects.
- **Monorepo support**: initialize an app package from the workspace root with `--target`.
- **Package-manager aware**: works with npm, yarn, pnpm, Bun, and Deno.
- **Overwrite warnings**: shows files that may be replaced before continuing.

## What It Can Add

| Toolchain       | What You Get                                        | Setup Source   |
| --------------- | --------------------------------------------------- | -------------- |
| TanStack Router | File-Based Routing or Code-Based Routing setup      | Official CLI   |
| Hot Updater     | React Native OTA update initializer                 | Official CLI   |
| Playwright      | Browser E2E test setup                              | Official CLI   |
| oxfmt           | Oxc formatter setup and editor integration          | Official CLI   |
| Prettier        | Prettier formatter setup and editor integration     | Built-in setup |
| oxlint          | Oxc linter setup and editor integration             | Official CLI   |
| ESLint          | ESLint config initializer and editor integration    | Official CLI   |
| Biome           | Biome formatter/linter setup and editor integration | Official CLI   |
| Knip            | `knip` package script                               | Built-in setup |
| React Doctor    | `react-doctor` package script                       | Built-in setup |
| Changesets      | Changeset release workflow                          | Official CLI   |
| Yarn SDKs       | Yarn PnP editor SDKs for VS Code                    | Official CLI   |

## Usage

Run the interactive flow:

```bash
toolchains-init
```

Initialize every available toolchain:

```bash
toolchains-init --yes
```

Choose a router mode:

```bash
toolchains-init --router file
toolchains-init --router code
```

Run without installing dependencies or official initializers:

```bash
toolchains-init --no-install
```

## Monorepos

From a workspace root, point `toolchains-init` at the app package:

```bash
npx toolchains-init --target apps/web
yarn dlx toolchains-init --target apps/web
pnpm dlx toolchains-init --target apps/web
```

All files, installs, and setup commands run inside the target directory.

## Notes

Run this in a freshly scaffolded app. Some selected toolchains can overwrite files such as router files, Playwright config, formatter config, linter config, or editor settings.

`--yes` uses the default File-Based Routing mode. Code-Based Routing requires TanStack Router's interactive CLI, so run without `--yes` if you want that mode.
