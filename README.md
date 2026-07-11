# toolchains-init

[![NPM](https://img.shields.io/npm/v/toolchains-init)](https://www.npmjs.com/package/toolchains-init)

Run the origin CLIs for the toolchains you usually add after creating a new app or package.

For a CLI-backed tool, `toolchains-init` may prepare a documented prerequisite, then runs the exact
origin command as that tool's final project mutation. It never edits the project afterward, guesses
the CLI's choices, or restricts the CLI's argument surface.

## Quick Start

Run it from your app directory:

```bash
npx toolchains-init
yarn dlx toolchains-init
pnpm dlx toolchains-init
```

Then choose the origin commands you want to run from the prompt.

## Key Features

- **Origin commands preserved**: runs each tool's own command with its stdin and argument semantics intact.
- **Pick only what you need**: routing, API mocking, E2E, formatting, linting, dead-code checks, release tooling, or editor SDKs.
- **Cataloged prompt**: toolchains are grouped by app foundation, quality, release, and editor setup.
- **Automation friendly**: select toolchains and pass namespaced origin CLI arguments in one command.
- **Fresh project friendly**: designed for newly scaffolded apps and packages.
- **Monorepo support**: initialize an app package from the workspace root with `--target`.
- **Package-manager aware**: works with npm, yarn, pnpm, Bun, and Deno.

## Supported Origin CLIs

| Toolchain            | Origin CLI Action                              | Source       |
| -------------------- | ---------------------------------------------- | ------------ |
| TanStack Router      | File-Based Routing or Code-Based Routing setup | Official CLI |
| Hot Updater          | React Native OTA update initializer            | Official CLI |
| Supabase             | Local Supabase project configuration           | Official CLI |
| Prisma               | Prisma schema and project configuration        | Official CLI |
| shadcn               | shadcn project initializer                     | Official CLI |
| Playwright           | Browser E2E test setup                         | Official CLI |
| Storybook            | Component workshop initializer                 | Official CLI |
| MSW                  | Browser API mocking worker setup               | Official CLI |
| CSpell               | Spell-checker configuration                    | Official CLI |
| Secretlint           | Secret-scanning configuration                  | Official CLI |
| oxfmt                | Oxc formatter initializer                      | Official CLI |
| Prettier             | Prettier project formatting check              | Official CLI |
| oxlint               | Oxc linter initializer                         | Official CLI |
| ESLint               | ESLint configuration initializer               | Official CLI |
| Biome                | Biome formatter/linter initializer             | Official CLI |
| Knip                 | Knip project analysis                          | Official CLI |
| React Doctor         | React project diagnostics                      | Official CLI |
| publint              | npm package compatibility validation           | Official CLI |
| Are the Types Wrong? | TypeScript package compatibility validation    | Official CLI |
| Changesets           | Changeset release workflow                     | Official CLI |
| Yarn SDKs            | Yarn PnP editor SDKs for VS Code               | Official CLI |

## Usage

Run the prompt-based flow:

```bash
toolchains-init
```

Each CLI-backed toolchain has a manifest-generated argument group. Select it with `--<tool>` and
forward a discovered upstream option with `--<tool>.<flag>[=value]`:

```bash
toolchains-init \
  --playwright \
  --playwright.browser=chromium \
  --playwright.lang=TypeScript \
  --tanstack-router \
  --tanstack-router.tailwind \
  --yes
```

Group names come from generated CLI manifests, so TanStack Router uses `--tanstack-router`.
Namespacing keeps flags from different origin CLIs separate; the wrapper removes that namespace
and otherwise preserves each token. It does not validate option names, value types, enum values, or
repetitions. The origin CLI owns all of those decisions.

For positionals, dash-prefixed values, `--`, or any other arbitrary token, repeat
`--<tool>.raw.arg=<token>`. Tokens retain their order and are forwarded only to that origin CLI:

```bash
toolchains-init \
  --msw \
  --msw.raw.arg=./public \
  --msw.raw.arg=--save
```

Newly added upstream options do not have to wait for a manifest refresh. Namespaced options are
accepted without inspecting their names; discovered manifest names exist only to populate focused
help.

Run focused help to see the option names currently discovered for one tool:

```bash
toolchains-init --playwright --help
toolchains-init --tanstack-router --help
```

Generated manifests own discovered flag names for help. A manifest refresh updates that list
without handwritten parser or adapter mapping. Parsing remains opaque: after removing the tool
namespace, tokens are not inferred, rewritten, deduplicated, or policy-filtered.

Automated runs require explicit `--<tool>` selectors. This keeps the command stable
when another adapter is added to the registry; `--yes` never expands silently to every tool.

`--yes` belongs only to `toolchains-init`: it is never forwarded to an origin CLI and never changes
that process's stdin. Any prompt or default owned by the origin CLI therefore behaves exactly as it
does when the command is run directly.

Choose the package manager explicitly when environment-based detection is not enough:

```bash
toolchains-init --package-manager pnpm --tanstack-router --msw --yes
```

Supported values are `npm`, `pnpm`, `yarn`, `bun`, and `deno`.

## Monorepos

From a workspace root, point `toolchains-init` at the app package:

```bash
npx toolchains-init --target apps/web
yarn dlx toolchains-init --target apps/web
pnpm dlx toolchains-init --target apps/web
```

Each origin command uses the target directory as its working directory.

For an automated monorepo setup, combine the target with generated tool groups:

```bash
npx toolchains-init \
  --target apps/web \
  --package-manager pnpm \
  --tanstack-router \
  --msw \
  --playwright \
  --playwright.browser=chromium \
  --yes
```

## Notes

Run this in a freshly scaffolded app. Origin CLIs may overwrite files such as router files,
Playwright config, formatter config, linter config, or editor settings. `toolchains-init` leaves the
state returned by each origin command untouched.
