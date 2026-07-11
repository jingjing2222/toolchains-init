---
name: add-toolchain-stack
description: Add or maintain a CLI-backed toolchain stack in the toolchains-init repo. Use when asked to scaffold an adapter, expose manifest-generated CLI argument groups, add initializer support, review or repair an automated CLI-manifest cron PR, or revisit adapter behavior after upstream docs markers, focused tests, or CLI execution fail. Preserve generated CLI manifests as the source of truth and keep handwritten adapters stable across routine upstream metadata updates.
---

# Add or Maintain a Toolchain Stack

## Ownership Contract

`toolchains-init` is a command runner, not a second implementation of an upstream CLI.

- The wrapper may prepare a prerequisite before the origin command only when official documentation or an executable test proves that the command needs it to start.
- The origin command is the terminal project mutation. After it returns, the wrapper must not edit files, package metadata, dependencies, or configuration for that tool.
- Preserve the origin CLI's stdin, prompts, exit status, and argument semantics. Wrapper `--yes` is never forwarded and never changes the origin process's stdin.
- Do not infer missing upstream choices, inject convenience presets, reinterpret an option, or policy-filter raw upstream tokens because the wrapper considers them unsafe or unnecessary.
- Handwritten adapters declare only stable command identity, proven prerequisites, and review evidence.
- `manifest.generated.json` owns the pinned upstream version, package-manager command templates, and discovered typed flags.

Core derives `--<manifest.tool>` selectors and typed `--<tool>.<flag>[=value]` options from the
manifest. Never add an individual upstream flag to a handwritten parser.

## Start Here

1. Inspect `git status` and preserve unrelated work.
2. Run `yarn new --help`; treat it as the authoritative scaffold-argument list.
3. Read:
   - `src/core/toolchain-adapter.ts`
   - `src/core/cli-command-manifest.ts`
   - `src/core/managed-cli.ts`
   - `src/core/external-toolchains.ts`
   - `scripts/update-cli-manifests.ts`
   - the nearest adapter and `init.test.ts`
4. Verify the exact origin command in official documentation and current package help.
5. Run that exact command in a clean representative project when practical. Observe its behavior; do not replace its choices with wrapper policy.

## Scaffold the Exact Command

Pass every known scaffold decision in one command instead of entering the scaffold prompt UI:

```bash
yarn new example \
  --stack-dir example \
  --package create-example \
  --command init \
  --label "Example" \
  --catalog quality \
  --docs-url https://example.com/docs/cli \
  --docs-confidence high \
  --docs-reason "The adapter runs the documented origin command unchanged." \
  --docs-section "CLI setup" \
  --docs-must-contain "create-example init" \
  --docs-check "Confirm this remains the complete origin command."
```

The generated adapter declares `managedCli: true`. The normal `command: "init"` form already puts
`init` in runtime templates, so do not repeat it in `commandArgs`.

Use `commandArgs` only for documented static tokens that are part of command identity. For a
flag-shaped initializer, for example:

```bash
yarn new example \
  --package example-cli \
  --command init \
  --subcommand none \
  --command-arg=--init \
  --docs-url https://example.com/docs/cli \
  --docs-must-contain "example-cli --init"
```

Order matters. Generated package-manager templates append `commandArgs` after the inferred
subcommand, including custom runner templates.

## Preserve the Upstream Argument Surface

Manifest flags provide the convenient typed namespace:

```bash
toolchains-init --example --example.template=react --example.force
```

- Boolean flags use presence syntax.
- String flags accept a value.
- Enum values remain exact and case-sensitive.
- Routine upstream flag additions become available after `yarn manifests:update`; they do not require adapter edits.

Typed discovery cannot represent every CLI grammar. Users can repeat
`--<tool>.raw.arg=<token>` for positional arguments, repeated flags, or complete token-by-token
passthrough:

```bash
toolchains-init \
  --example \
  --example.raw.arg=./packages/app \
  --example.raw.arg=--tag \
  --example.raw.arg=one \
  --example.raw.arg=--tag \
  --example.raw.arg=two
```

Raw tokens retain their order and reach only the selected origin CLI. They are the escape hatch for
upstream syntax, not adapter-owned policy.

## Keep the Adapter Thin

For every CLI-backed adapter:

- Declare CLI metadata and at least one official `docs` source with actionable review metadata.
- Use `managedCli: true`; it is a marker that the manifest command executes.
- Put only origin-command identity in `command`, `subcommand`, and `commandArgs`.
- Let core resolve the pinned package-manager template and merge typed and raw user arguments.
- Add prerequisite preparation only before command execution and only with evidence tied to the adapter and its focused test.
- Leave the files and package state produced by the CLI untouched after execution.
- Keep selection on generated `--<manifest.tool>` groups; do not add aliases or per-tool parser cases.

If a generated command is wrong, update CLI metadata or the generator and run
`yarn manifests:update`. Never patch generated JSON by hand.

## Test the Boundary

The focused adapter test must mock command execution and assert the exact call:

- correct working directory;
- exact package-manager binary and pinned origin arguments;
- static `commandArgs` in their documented order;
- typed and raw user tokens forwarded without reinterpretation;
- the core runner's unconditional inherited stdio, including when wrapper `yes` is true;
- exactly one origin-command execution and no wrapper mutation afterward.

Use a real clean-project smoke test only as additional evidence. Assertions about files produced by
the origin CLI may prove that the command ran, but they do not authorize the wrapper to reproduce or
amend those files.

## Make Command Identity Docs-Backed

Every handwritten prerequisite and static command token needs an official source and review metadata:

- `reason` explains the exact dependency on the source.
- `files` names the adapter and focused test.
- `mustContain` proves the relevant command still exists.
- `checks` asks a maintainer to verify the complete invocation and the no-after-mutation boundary.
- `sections` identifies the relevant human-facing area when useful.

Prefer official setup docs, then official package docs, then the upstream raw README or source. Do
not weaken a failed marker merely to make automation green; determine whether the origin command
changed.

After metadata changes, run `yarn manifests:update` and inspect generated diffs. Accept unrelated
routine metadata only when it belongs in the requested change.

## Review an Automated Manifest PR

1. Confirm changes are restricted to generated manifests and the automation changeset.
2. For version, command-template, or additive-flag drift, run manifest validation and focused tests without editing the adapter.
3. Review removed or type-changed public flags, while keeping raw passthrough available for all upstream tokens.
4. Review handwritten files only when a static command token, prerequisite, docs marker, or exact-command test changed.
5. Confirm the wrapper still makes no project mutation after each origin command returns.

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

Change core command execution only when the exact origin invocation cannot use the existing runner.

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

Review the final diff for generated-file ownership, exact origin-command identity, ordered raw
passthrough, proven prerequisites, inherited stdin, and absence of mutation after the command.
Repeat independent review and fixes until no P1 or P2 findings remain.
