---
name: add-toolchain-stack
description: Add or maintain a CLI-backed toolchain stack in the toolchains-init repo. Use when asked to scaffold an adapter, expose manifest-generated CLI argument groups, add initializer support, review or repair an automated CLI-manifest cron PR, or revisit adapter behavior after upstream docs markers, focused tests, or CLI execution fail. Preserve generated CLI manifests as the source of truth and keep handwritten adapters stable across routine upstream metadata updates.
---

# Add or Maintain a Toolchain Stack

## Ownership Contract

Keep maintenance boundaries strict:

- Handwritten adapters declare stable product policy and lifecycle behavior.
- Core owns selection, package-manager orchestration, project detection, and conditional CLI policy.
- `manifest.generated.json` owns upstream version data, package-manager command templates, and the public managed-argument names, types, and enum values.
- Core derives `--<manifest.tool>` groups and `--<tool>.<generated-flag>[=value]` options from that manifest. Never add an individual upstream flag to the handwritten parser.
- Routine cron changes to versions, templates, or additive generated flags do not require handwritten adapter edits.
- Reopen adapter policy only for a consumed or required flag contract, a removed or type-changed public flag, a docs marker, a focused smoke failure, or an initializer that no longer executes.

Do not turn a generated-only refresh into a broad adapter cleanup.

## Start Here

1. Inspect `git status` and preserve unrelated work.
2. Run `yarn new --help`; treat it as the authoritative scaffold-argument list.
3. Read:
   - `src/core/toolchain-adapter.ts`
   - `src/core/cli-command-manifest.ts`
   - `src/core/external-toolchains.ts`
   - `scripts/update-cli-manifests.ts`
   - the nearest adapter and `init.test.ts`
4. Verify the current official initializer using official docs and package help. Test a clean representative project when unattended behavior matters.
5. Prefer the official initializer. Use built-in setup only when no official setup exists or it cannot be represented safely; document that decision in code, tests, and user-facing docs.

## Scaffold Without Interaction

Agents should pass every required decision in one command instead of entering the prompt UI. Start from `yarn new --help`, then include all applicable optional overrides.

```bash
yarn new example \
  --stack-dir example \
  --package create-example \
  --command init \
  --label "Example" \
  --catalog quality \
  --docs-url https://example.com/docs/cli \
  --docs-confidence high \
  --docs-reason "The adapter runs the documented initializer command." \
  --docs-section "CLI setup" \
  --docs-must-contain "create-example init" \
  --docs-check "Confirm the complete initializer still finishes without stdin." \
  --supports-non-interactive
```

Replace the final capability switch with `--interactive-only-reason "<specific remaining prompt>"` when full unattended execution is not possible. Never pass both switches.

The scaffold is a starting point. Replace generated TODO assertions with tool-specific evidence before merge.

An executable CLI scaffold declares `managedCli: { phase: "run" }`. Its manifest tool becomes the
public selector and argument namespace automatically:

```bash
toolchains-init --example --example.template=react --yes
toolchains-init --example --help
```

Do not add `template` to the adapter or core parser. It is accepted only when the generated manifest
declares it.

## Classify Interaction Correctly

Judge the complete initializer, not its first command or advertised `--yes` flag. From a clean project, account for dependency installation, provider selection, authentication, credentials, follow-up configuration, and post-install hooks.

For a fully unattended initializer:

- Pass `--supports-non-interactive` when scaffolding.
- Leave `adapter.nonInteractive` absent. Supported behavior has no positive adapter marker.
- Keep an enabled, non-skipped lifecycle smoke test that runs with `yes: true` and asserts meaningful files, dependencies, or configuration.

For an initializer that still needs stdin or project-specific choices:

- Pass a precise `--interactive-only-reason`.
- Store only the negative exception:

```ts
nonInteractive: {
  supported: false,
  reason: "provider credentials require project-specific choices",
},
```

- Keep the default test deterministic: mock command execution, resolve the generated command, exercise the shared core lifecycle with `yes: false`, and assert the exact `runCommand` call.
- Put real interactive coverage behind an explicit opt-in E2E environment variable when it adds value.

If the unattended assertion has not been proven end to end, classify the adapter as interactive-only.

## Keep the Adapter Thin

For every CLI-backed adapter:

- Declare CLI metadata and at least one official `docs` source with review metadata.

When the initializer executes through the shared managed runner, declare its stable command
consumer once through `managedCli`:

- `phase` selects the shared lifecycle phase, such as `run` or `afterInstall`.
- `defaults` are stable values users may override.
- `locked` are required adapter invariants and reject conflicting user values.
- `blocked` excludes upstream options that violate the adapter's product boundary.
- `positionals` contains only stable adapter-owned positional arguments the manifest cannot represent; core inserts them before generated flags.
- `setup` declares rare wrapper-owned choices under the collision-proof `--<tool>.setup.<name>` namespace and binds each one to a typed `ToolchainOptions` field without a per-tool parser case.
- `execute` is reserved for commands that need stable work before or after the shared runner.

For managed CLI adapters:

- Let core merge and validate manifest-derived user arguments. Do not enumerate every discovered flag in the adapter or add per-tool parser cases.
- Use manifest logical keys only for stable `defaults`, `locked`, or `blocked` policy. Never duplicate CLI spellings, types, enum values, versions, or package-manager templates.
- Keep `positionals` docs-backed. Do not use them as an escape hatch for representable flags.
- Use core lifecycle hooks for package-json mutations and install phases; do not embed package-manager switch logic in the adapter.
- Use `packageJson` passed by core and shared dependency helpers. Do not reread project state ad hoc.
- Keep selection on generated `--<manifest.tool>` groups; do not add parallel global selectors or per-tool aliases.

If a generated command is wrong, update CLI metadata or the generator and run `yarn manifests:update`. Never patch generated JSON by hand.

For user-facing verification, use the manifest tool group:

```bash
toolchains-init --playwright --playwright.browser=chromium --yes
toolchains-init --tanstack-router --help
```

## Make Policy Docs-Backed

Every handwritten adapter choice, including the interaction classification, needs an official source and actionable review metadata:

- `reason` explains the exact policy tied to the source.
- `files` names the adapter and focused test.
- `mustContain` uses short, stable strings that prove the relevant upstream section still exists.
- `checks` asks what a maintainer must verify when a marker changes.
- `sections` identifies the relevant human-facing area when useful.

Prefer official setup docs, then official package docs, then the upstream raw README or source. Do not weaken a failed marker merely to make automation green; determine whether the adapter contract changed.

After metadata changes, run `yarn manifests:update` and inspect generated diffs. Accept unrelated routine metadata only when it belongs in the requested change.

## Review an Automated Manifest PR

Use the PR body and diff to decide scope:

1. Confirm changes are restricted to generated manifests and the automation changeset.
2. For version, command-template, or additive-flag drift, run manifest validation and focused tests without editing the adapter. A new flag should appear in its generated public group automatically.
3. Explicitly review removed or type-changed public flags, even when the adapter did not consume them.
4. Review the named policy files only when a consumed/default/locked contract changes, a docs marker changes, a focused smoke fails, or the upstream CLI no longer runs.
5. Change handwritten adapter code only when evidence shows its stable policy must change.

An existing stable adapter should otherwise remain untouched after its initial addition.

## Expected Change Set

A new CLI-backed stack normally includes:

- `src/stacks/<stack>/adapter.ts`
- `src/stacks/<stack>/index.ts`
- `src/stacks/<stack>/init.test.ts`
- `src/stacks/<stack>/manifest.ts`
- `src/stacks/<stack>/manifest.generated.json`
- generated registry files produced by `yarn manifests:update`
- user-facing docs when support is visible
- a changeset

Change core lifecycle code only when the tool cannot use an existing phase.

## Validate and Review

Run narrow checks while iterating:

```bash
yarn oxfmt --write <changed-files>
yarn manifests:check
yarn typecheck
yarn test <focused-test-files>
```

Then run:

```bash
yarn verify
```

Review the final diff for generated-file ownership, manifest-derived public arguments, complete unattended behavior, meaningful tests, and docs-backed exceptions. Verify that adding a synthetic manifest flag changes help and parsing without changing adapter or parser source. Repeat independent review and fixes until no P1 or P2 findings remain. Report any opt-in E2E that was not run and why.
