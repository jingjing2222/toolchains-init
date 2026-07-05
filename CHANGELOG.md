# toolchains-init

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
