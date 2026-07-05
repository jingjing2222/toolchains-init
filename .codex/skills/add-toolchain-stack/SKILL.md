---
name: add-toolchain-stack
description: Add a new stack/toolchain to the ait-toolchain repo. Use when asked to add support for a tool such as Hot Updater, Playwright, router, formatter, linter, release tool, editor setup, or another CLI-backed stack; especially when the work must preserve generated CLI manifest JSON as the source of truth, add lifecycle hooks correctly, update tests/docs/changesets, and verify with current official initializer behavior.
---

# Add Toolchain Stack

## Goal

Add a stack in the existing ait-toolchain architecture without leaking package-manager logic, generated manifest logic, or project detection into the adapter.

The adapter should declare toolchain behavior. Core owns lifecycle orchestration. Generated manifest JSON owns CLI command templates. CLI/init owns project package.json reading.

## Starting Workflow

1. Create a feature branch first, unless already on the requested branch.
2. Inspect current patterns before editing:
   - `src/core/toolchain-adapter.ts`
   - `src/core/package-json.ts`
   - `src/core/files.ts`
   - `src/core/external-toolchains.ts`
   - one similar `src/stacks/*/adapter.ts`
   - one similar `src/stacks/*/init.test.ts`
   - `scripts/update-cli-manifests.ts`
3. If the stack is CLI-backed, prefer `yarn new ...` to scaffold adapter/test/manifest files, then refine.
4. Resolve current initializer behavior from official docs or package help when it may have changed.
5. Run `yarn manifests:update` after adapter CLI metadata changes.

## Official Initializer First

If an official initializer/setup CLI exists, use it. Do not replace it with a built-in config writer just because the CLI is interactive, awkward to test, or does not support `--yes`.

Allowed fallback to built-in setup:

- The tool has no official initializer/setup CLI.
- The stack is intentionally a lightweight package script or editor integration and no initializer exists.
- The official CLI cannot be represented or run safely at all; document why in code/tests/README.

Interactive official CLIs are acceptable for users. Default tests must adapt to the interactivity, not the production implementation:

- Do not run interactive CLIs in default CI tests unless they have stable non-interactive flags.
- Test manifest command generation, package-json/editor side effects, target file detection, and `--no-install` behavior.
- Add opt-in E2E tests for interactive initializer smoke coverage when useful.

If CLI help probing is broken or unsupported, set `help: false`, add high-confidence official docs, and still generate the manifest from npm metadata.

Do not hand-create config files for tools that have an official initializer. For example, ESLint should run `@eslint/create-config`; it should not write `eslint.config.js` itself.

Do not add package scripts by default unless the script is the stack's explicit purpose or the official initializer/docs require it. User package scripts are user policy.

## Adapter Rules

Keep adapters thin.

Allowed adapter responsibilities:

- Declare `feature`, `label`, `catalog`, `order`, `package`, `command`, `packageManagers`, `hint`, `docs`.
- Gate availability using data passed in context.
- Run `resolveCliCommand(<manifest>, <commandId>, packageManager)` and `runCommand`.
- Add package-json mutations through lifecycle hooks such as `beforeRun` or `updatePackageJson`.
- Emit user notes.

Avoid in adapters:

- Do not hand-write package-manager command switches.
- Do not create a `localCliCommand` helper when a generated manifest exists.
- Do not duplicate generated JSON command templates inside adapter `runner` unless the manifest generator cannot represent the command.
- Do not read `package.json`; use `packageJson` passed by core context.
- Do not implement ad hoc `hasDependency`; use shared core helpers such as `hasPackageDependency`.
- Do not do the same package-json mutation in both `beforeRun` and `updatePackageJson` unless both lifecycle phases truly need the final package.json to retain it.

Use upstream project descriptions for prompt hints when available. Example for Hot Updater:

```ts
hint: "Self-hostable OTA update solution for React Native",
```

## Generated Manifest Is SSoT

For CLI-backed stacks, command templates must come from `manifest.generated.json`.

Normal path:

```ts
const { someCliManifest } = await import("./manifest");
const command = resolveCliCommand(someCliManifest, "init", packageManager);
await runCommand(cwd, command.bin, command.args);
```

If command templates are wrong, change toolchain CLI metadata or the manifest generator, then run:

```bash
yarn manifests:update
```

Do not patch generated files by hand except to inspect diffs.

## Lifecycle Pattern

Some CLIs require their package to exist in the project before their initializer runs. Do not install that package in the adapter with package-manager switches.

Add or reuse a core lifecycle:

1. Add `beforeRun?: (context: UpdatePackageJsonContext) => void` to `ToolchainAdapter`.
2. Add `updatePackageJsonBeforeRun(...)` that applies only `beforeRun` hooks.
3. Add `writeBeforeRunToolchain(...)` that writes package.json only when selected toolchains have a `beforeRun` hook.
4. In `runInit`, before `runExternalToolchains`, call `writeBeforeRunToolchain`; if it returned true, run one normal package-manager install.
5. In the adapter, use `beforeRun({ cliManifest, packageJson }) { setManifestDevDependency(packageJson, cliManifest); }`.

Do not also add the same dependency in `updatePackageJson` unless the final write would otherwise remove it.

## Availability Pattern

Core should read package.json once and pass it through:

```ts
const packageJson = await readPackageJson(cwd);
const availableToolchains = await getAvailableToolchains({ cwd, packageJson, packageManager });
```

Stack adapter should only inspect that object:

```ts
isAvailable({ packageJson, packageManager }) {
  if (packageManager === "deno") return false;
  return hasPackageDependency(packageJson, "react-native");
}
```

## E2E Pattern

If a real initializer requires credentials, accounts, cloud projects, or interactive provider setup:

- Keep default tests deterministic and offline-friendly.
- Add opt-in E2E behind an env var such as `HOT_UPDATER_E2E_PROVIDER`.
- For React Native stacks, scaffold the latest RN app in the opt-in E2E:

```bash
npx --yes @react-native-community/cli@latest init HotUpdaterSmoke --pm npm --skip-install
```

Then install the manifest-pinned CLI package and run the initializer with explicit flags if the provider supports non-interactive operation.

Do not make default CI depend on cloud credentials or provider prompts.

## Expected Files

For a new stack, expect some subset:

- `src/stacks/<stack>/adapter.ts`
- `src/stacks/<stack>/index.ts`
- `src/stacks/<stack>/init.test.ts`
- `src/stacks/<stack>/manifest.ts`
- `src/stacks/<stack>/manifest.generated.json`
- generated registry updates:
  - `src/stacks/toolchains.generated.ts`
  - `src/stacks/manifest-registry.generated.ts`
- generated feature type updates:
  - `BuiltInFeature` is generated in `src/stacks/toolchains.generated.ts`
  - `src/core/types.ts` should import that type; do not maintain a manual feature union there
- core lifecycle updates only when needed
- test updates such as `test/cli-command-manifest.test.ts`
- README table update when user-visible, including setup source such as `Official CLI` or `Built-in setup`
- Changeset for package behavior changes

## Validation

Run narrow checks while iterating:

```bash
yarn oxfmt --write <changed files>
yarn manifests:check
yarn typecheck
yarn test <relevant test files>
```

Run full verification before final:

```bash
yarn format:check && yarn lint && yarn typecheck && yarn manifests:check && yarn test && yarn build && yarn pack:check
```

Report skipped opt-in E2E explicitly when credentials/provider setup were not supplied.
