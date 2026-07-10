# toolchains-init

[![NPM](https://img.shields.io/npm/v/toolchains-init)](https://www.npmjs.com/package/toolchains-init)

Set up the toolchains you usually add after creating a new app or package.

`toolchains-init` runs the official initializers for the tools you choose, then applies the small workspace setup those tools expect: editor settings, package scripts, router files, test config, API mocking, and release tooling.

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
- **Pick only what you need**: routing, API mocking, E2E, formatting, linting, dead-code checks, release tooling, or editor SDKs.
- **Cataloged prompt**: toolchains are grouped by app foundation, quality, release, and editor setup.
- **Automation friendly**: select supported toolchains and defaults in one non-interactive command.
- **Fresh project friendly**: designed for newly scaffolded apps and packages.
- **Monorepo support**: initialize an app package from the workspace root with `--target`.
- **Package-manager aware**: works with npm, yarn, pnpm, Bun, and Deno.
- **Overwrite warnings**: shows files that may be replaced before continuing.

## What It Can Add

| Toolchain       | What You Get                                        | Setup Source   |
| --------------- | --------------------------------------------------- | -------------- |
| TanStack Router | File-Based Routing or Code-Based Routing setup      | Official CLI   |
| Hot Updater     | React Native OTA update initializer                 | Official CLI   |
| Playwright      | Browser E2E test setup                              | Official CLI   |
| Storybook       | React Vite component workshop setup                 | Official CLI   |
| MSW             | Browser API mocking worker setup                    | Official CLI   |
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

Run a fully specified, non-interactive setup by combining `--toolchains` with `--yes`:

```bash
toolchains-init --toolchains router,playwright,oxlint --router file --yes
```

`--toolchains` accepts `all` or a comma-separated list of kebab-case toolchain IDs and skips the toolchain picker. Run `toolchains-init --help` to see every current ID and option.

Select every toolchain available for the target (including interactive-only initializers):

```bash
toolchains-init --toolchains all
```

For backward compatibility, `--yes` without `--toolchains` still selects every available toolchain and accepts defaults and overwrite confirmation. Before changing files, it now reports any interactive-only initializer that prevents an unattended run.

Choose the package manager explicitly when environment-based detection is not enough:

```bash
toolchains-init --package-manager pnpm --toolchains router,msw --router file --yes
```

Supported values are `npm`, `pnpm`, `yarn`, `bun`, and `deno`.

Hot Updater and ESLint are marked interactive-only because their official initializers still require project-specific prompts after the documented CLI arguments are supplied. Run them without `--yes` instead of relying on brittle prompt automation:

```bash
toolchains-init --toolchains hot-updater
toolchains-init --toolchains eslint
```

Choose a router mode:

```bash
toolchains-init --toolchains router --router file --yes
toolchains-init --toolchains router --router code
```

Code-Based Routing still uses TanStack Router's interactive CLI, so it cannot be combined with `--yes`.

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

For a non-interactive monorepo setup, combine the target with an explicit selection:

```bash
npx toolchains-init \
  --target apps/web \
  --package-manager pnpm \
  --toolchains router,msw,playwright \
  --router file \
  --yes
```

## Notes

Run this in a freshly scaffolded app. Some selected toolchains can overwrite files such as router files, Playwright config, formatter config, linter config, or editor settings.

For fully non-interactive use, provide an explicit `--toolchains` selection that excludes help-listed interactive-only initializers and add `--yes`. Invalid, unavailable, or unsupported selections fail before setup begins.
