---
name: add-toolchain-stack
description: Add or maintain a CLI-backed toolchain stack in the toolchains-init repo. Use when asked to scaffold an adapter, add initializer support, review or repair an automated CLI-manifest cron PR, or revisit adapter behavior after upstream docs markers, focused tests, or CLI execution fail. Preserve generated CLI manifests as the source of truth and keep handwritten adapters stable across routine upstream metadata updates.
---

# Add or Maintain a Toolchain Stack

## Ownership Contract

Keep maintenance boundaries strict:

- Handwritten adapters declare stable product policy and lifecycle behavior.
- Core owns selection, package-manager orchestration, project detection, and conditional CLI policy.
- `manifest.generated.json` owns upstream version data, package-manager command templates, and discovered flag names, types, and enum values.
- Routine cron changes to versions, templates, or newly discovered but unused flags do not require handwritten adapter edits.
- Reopen adapter policy only when a docs marker or review check changes, a focused test fails, the initializer no longer executes, or a manifest flag the adapter actually uses changes incompatibly.

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

- Keep the default test deterministic: mock execution, resolve the generated command, call `adapter.run` with `yes: false`, and assert the exact `runCommand` call.
- Put real interactive coverage behind an explicit opt-in E2E environment variable when it adds value.

If the unattended assertion has not been proven end to end, classify the adapter as interactive-only.

## Keep the Adapter Thin

For every CLI-backed adapter:

- Declare CLI metadata and at least one official `docs` source with review metadata.
- Dynamically import the generated manifest in `run` when needed to avoid registry cycles.
- Call `resolveCliCommand(manifest, commandId, packageManager, logicalFlags)` and then `runCommand`.
- Use manifest-backed logical flags for any option the adapter consumes. Do not duplicate discovered CLI spellings, types, enum values, versions, or package-manager templates.
- Append raw arguments only for positional inputs the manifest contract cannot represent. Add focused docs-backed tests for the exception.
- Use core lifecycle hooks for package-json mutations and install phases; do not embed package-manager switch logic in the adapter.
- Use `packageJson` passed by core and shared dependency helpers. Do not reread project state ad hoc.
- Put selection-dependent behavior such as router-mode validation in CLI/core, not in a managed adapter.

If a generated command is wrong, update CLI metadata or the generator and run `yarn manifests:update`. Never patch generated JSON by hand.

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
2. For version, template, or unused-flag drift, run manifest validation and focused tests without editing the adapter.
3. If the PR reports a changed docs marker, failed review check, focused test failure, used-flag contract break, or initializer execution failure, review only the named policy files and upstream source.
4. Change handwritten code only when evidence shows the stable contract itself must change.

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

Review the final diff for generated-file ownership, complete unattended behavior, meaningful tests, and docs-backed exceptions. Repeat independent review and fixes until no P1 or P2 findings remain. Report any opt-in E2E that was not run and why.
