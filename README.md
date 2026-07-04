# toolchains-init

Initialize the React toolchain pieces you usually add after creating a fresh app.

`toolchains-init` is not another app template. It runs official setup commands for the tools you choose, then adds a small amount of glue where the tools expect workspace files such as editor settings or package scripts.

Use it when you already have a new Vite React app and want to add router, E2E, formatting, linting, dead-code checks, release tooling, or editor setup without repeating the same manual steps every time.

## Quick Start

Create a Vite React app first:

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
```

Then run `toolchains-init`:

```bash
yarn dlx toolchains-init
```

You will get an interactive prompt for the toolchains to add.

## Workspace Apps

In a monorepo, run from the workspace root and point at the app package:

```bash
yarn dlx toolchains-init --target apps/web
```

All files, installs, and official initializers run in the target directory. The workspace root is left alone unless it is the target.

## What It Can Add

- TanStack Router through `@tanstack/cli create --router-only`
- Playwright through the official Playwright initializer
- oxfmt through `oxfmt --init`
- oxlint through `oxlint --init`
- Biome through `biome init`
- VS Code, Cursor, and Zed workspace settings for the selected formatter and linter tools
- `knip` script through `npx knip`
- `react-doctor` script through `npx react-doctor@latest`
- Changesets through `changeset init`
- Yarn PnP editor SDKs through `yarn dlx @yarnpkg/sdks vscode`

The formatter and linter adapters do not replace your existing `format`, `lint`, or `verify` scripts. They set up the tools and editor integration; you decide how to wire scripts for each app.

## Usage

```bash
yarn dlx toolchains-init
npx toolchains-init
pnpm dlx toolchains-init
```

Useful flags:

```bash
toolchains-init --target apps/web
toolchains-init --yes
toolchains-init --yes --router file
toolchains-init --no-install
```

`--yes` selects all available toolchains. File-Based Routing is the default router mode. Code-Based Routing still requires the interactive TanStack Router CLI, so run without `--yes` if you want that mode.

`--no-install` updates local files and `package.json`, but skips official initializers, package install, and post-install setup. It is mainly useful for tests.

## Warning

Run this only in a freshly scaffolded app or package directory.

The command can overwrite files at known toolchain paths, such as editor settings, router files, Playwright config, or tool config files. When running interactively, existing target files are listed before overwrite confirmation.

## Release

Versions are managed with Changesets.

```bash
yarn changeset
```

After the release PR is merged, GitHub Actions publishes to npm with `NPM_TOKEN`.
