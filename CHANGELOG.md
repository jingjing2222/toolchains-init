# toolchains-init

## 0.1.0

### Minor Changes

- 50aff6a: Add CSpell, Secretlint, Supabase, Prisma, shadcn, publint, and Are the Types Wrong toolchains.
  Run every selected origin CLI as the terminal project operation: preserve stdin and exit codes,
  forward ordered namespaced or raw arguments without interpreting option types or values, and remove
  wrapper-owned postprocessing and guessed CLI policies. Generated CLI flags are discovery-only help
  metadata; the origin CLI owns argument validation.

## 0.0.9

### Patch Changes

- d7b9775: Update generated CLI command manifests from upstream package metadata.
- c12c7dd: Add direct `--<tool>` selection and manifest-generated `--<tool>.<flag>` arguments, along with package-manager overrides, focused help, and side-effect-free validation for non-interactive CLI setup. `--yes` now exits early when a selected official initializer still requires interaction instead of entering that initializer's prompts.

  Require explicit direct selectors for unattended runs. Selection and router mode use only the generated tool namespace; no parallel `--toolchains` or global `--router` compatibility surface is included.

  Make new CLI-backed adapters run through a shared manifest resolver and require docs-backed interaction classification. Routine upstream argument additions now update generated help and parsing without handwritten parser or adapter edits; adapter review remains limited to stable policy contracts, docs markers, focused smoke failures, or an initializer that no longer executes.

## 0.0.8

### Patch Changes

- ff2d323: Update generated CLI command manifests from upstream package metadata.

## 0.0.7

### Patch Changes

- da26a0e: Update generated CLI command manifests from upstream package metadata.

## 0.0.6

### Patch Changes

- 777684c: Add docs-backed review metadata to every built-in CLI adapter so automated manifest update PRs can point maintainers to the relevant adapter policy source.
- 154198b: Add docs-backed adapter review metadata and exact docs text checks to generated CLI manifests, then surface adapter review guidance only when those checks change or fail.

## 0.0.5

### Patch Changes

- 25d9dda: Add generated CLI command manifests as the source of truth for stack initializers.

  This includes Valibot validation, generated stack registries, exported `manifest.generated.json` files, Bun and Deno command templates, cataloged interactive prompts, a `yarn new` scaffold for co-located adapters and init tests, daily manifest update automation, and mise-based CI setup.

- 1ea3347: Add an MSW toolchain backed by the official `msw init` CLI for Vite browser worker setup.
- 1ea3347: Add a React Native-only Hot Updater toolchain and prepare manifest-backed CLI dependencies before running interactive initializers.
- 1ea3347: Add Prettier and ESLint toolchains with manifest-pinned package versions, config files, package scripts, and editor recommendations.
- 5650f65: Update package metadata and document TanStack Router dependency section merge behavior.
- 1ea3347: Add a React Vite Storybook toolchain backed by the official create-storybook initializer.

## 0.0.4

### Patch Changes

- 93a79aa: Preserve existing package.json fields and dependency versions when running the TanStack Router initializer, keeping only newly added dependencies from the official CLI output.

## 0.0.3

### Patch Changes

- f3692d6: Detect Yarn PnP projects from target project files so oxlint schema cleanup and Yarn SDK setup run correctly when using `yarn dlx`.

  Change the interactive prompt defaults so no toolchains are preselected.

- 3ab25f1: Simplify the README quick start so it starts from an existing app directory instead of showing Vite app creation steps.

## 0.0.2

### Patch Changes

- 5769c8f: Fix the CLI version test to follow the package.json version and update README usage examples for npm, Yarn, and pnpm.

## 0.0.1

### Patch Changes

- fc80a4b: Add a CLI that initializes an opinionated Vite React toolchain.
