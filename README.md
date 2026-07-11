# toolchains-init

[![NPM](https://img.shields.io/npm/v/toolchains-init)](https://www.npmjs.com/package/toolchains-init)

`toolchains-init` starts where templates stop. Discover, review, and compose official setup CLIs for
an existing app, package, or workspace.

The wrapper owns the curated catalog, version-pinned invocation, execution plan, and provenance.
Each origin CLI owns its prompts, arguments, project changes, and success or failure. Choose once;
run the originals unchanged.

## Quick Start

Run it from the project you want to configure:

```bash
npx toolchains-init
yarn dlx toolchains-init
pnpm dlx toolchains-init
```

The interactive flow is:

```text
select tools -> review the complete plan -> confirm -> run
```

Nothing runs before the plan is complete. Origin commands run sequentially in canonical catalog
order, which is the displayed order.

## Catalog

The catalog contains setup commands that add a capability to an existing project. It intentionally
excludes project checks, diagnostics, builds, migrations, and full application scaffolds.

| Area           | Selector        | Setup                                                  |
| -------------- | --------------- | ------------------------------------------------------ |
| App & Services | `--hot-updater` | Hot Updater configuration for React Native OTA updates |
| App & Services | `--prisma`      | Prisma schema and project configuration                |
| App & Services | `--shadcn`      | shadcn project initialization                          |
| App & Services | `--supabase`    | Local Supabase project configuration                   |
| Testing & UI   | `--playwright`  | Playwright browser testing setup                       |
| Testing & UI   | `--storybook`   | Storybook component workshop setup                     |
| Code Quality   | `--oxfmt`       | Oxc formatter configuration                            |
| Code Quality   | `--oxlint`      | Oxc linter configuration                               |
| Code Quality   | `--eslint`      | ESLint configuration                                   |
| Code Quality   | `--biome`       | Biome formatter and linter configuration               |
| Code Quality   | `--cspell`      | CSpell configuration                                   |
| Code Quality   | `--secretlint`  | Secretlint configuration                               |
| Release        | `--changesets`  | Changesets versioning and release workflow             |
| Editor         | `--yarn-sdks`   | Yarn PnP SDK generation for VS Code (Yarn only)        |

## Review a Plan, Then Run

Passing selectors skips the wrapper's selection and confirmation prompts. The complete plan is
still printed before execution:

```bash
toolchains-init --playwright --biome
```

The plan shows the target directory, package manager, command order, pinned package versions, exact
executables and argument arrays, documentation sources, and any overlapping capabilities. For
example, choosing Biome with oxfmt or oxlint produces an informational overlap warning; it does not
block the selection or rewrite either command.

Use `--plan` to inspect the same plan without starting an origin process:

```bash
toolchains-init --plan --playwright --biome
```

With no selectors, `--plan` opens the interactive selector and stops after printing the plan. With
no selectors in a non-interactive environment, the command fails instead of guessing a selection.

There is no wrapper `--yes` option. Explicit selectors are the automation boundary. A namespaced
origin option such as `--shadcn.yes` is different: it is forwarded to shadcn as `--yes`.

## Forward Origin Arguments

Select an origin CLI with `--<tool>` and route an option to it with
`--<tool>.<flag>[=value]`:

```bash
toolchains-init \
  --playwright \
  --playwright.browser=chromium \
  --biome \
  --biome.verbose
```

The wrapper removes only the tool namespace. It does not validate flag names, infer value types,
check enum values, deduplicate repetitions, or decide whether an upstream version supports the
option. Newly added upstream options can therefore be used before the generated manifest is
refreshed.

For positionals, `--`, dash-prefixed values, repeated arguments, or complete token-by-token
passthrough, repeat `--<tool>.raw.arg=<token>`:

```bash
toolchains-init \
  --playwright \
  --playwright.raw.arg=-- \
  --playwright.raw.arg=tests/e2e
```

Raw tokens retain their order and are sent only to the selected origin CLI.

Focused help lists the option names currently discovered for one origin CLI:

```bash
toolchains-init --playwright --help
```

Generated manifest flags power help only. Parsing remains opaque, and the origin CLI remains the
authority on its argument surface.

## Targets and Package Managers

From a workspace root, point every planned command at a package with `--target`:

```bash
toolchains-init \
  --target apps/web \
  --package-manager pnpm \
  --playwright \
  --biome
```

Every origin process uses the resolved target as its working directory. Supported package-manager
values are `npm`, `pnpm`, `yarn`, `bun`, and `deno`, subject to the runner templates available for a
tool. Yarn SDKs are exposed only when Yarn is selected.

## Execution Contract

- The complete plan must resolve before any origin process starts.
- Selected commands are sorted into canonical catalog order, then run sequentially in the displayed
  order with inherited stdin, stdout, and stderr.
- The first failed command stops the run; later commands are not started.
- Completed and partial project changes are not rolled back or cleaned up.
- Exact numeric exit codes are preserved. Terminating signals are re-raised when Node can safely do
  so; Node-reserved or ignored signals such as `SIGUSR1` and `SIGPIPE` use the conventional
  `128 + signal` nonzero status.
- An origin CLI is the final project mutation for its tool. The wrapper does not edit its output,
  dependencies, package metadata, or configuration afterward.

Generated manifests pin the package version and package-manager invocation and record the official
source used to review it. This makes the handoff inspectable and repeatable: the same executable,
argument tokens, working directory, and version can be planned again. It does not promise identical
project output across operating systems, registries, transitive dependencies, or different starting
states.
