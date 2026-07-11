---
name: add-toolchain-stack
description: Add or maintain an init-only origin CLI in the toolchains-init catalog. Use when scaffolding a canonical tool definition, exposing manifest-generated focused help, reviewing origin-command evidence, or repairing an automated manifest update. Keep adapter identity stable, generated manifest v1 data authoritative, and origin arguments opaque.
---

# Add or Maintain a Toolchain

## Product Boundary

`toolchains-init` starts where templates stop. It discovers, plans, and runs official setup CLIs for
an existing app, package, or workspace.

The wrapper owns:

- catalog inclusion, labels, areas, capabilities, and ordering;
- one canonical tool ID;
- the target directory and package-manager selection;
- the complete execution plan, pinned invocation, and documentation provenance;
- informational warnings about overlapping capabilities.

The origin CLI owns:

- prompts, defaults, option names, values, and validation;
- files, dependencies, package metadata, and configuration it creates or changes;
- success, failure, exit code, and signal.

The origin process is the only project mutation for its tool. Do not prepare, reproduce, amend,
clean up, or roll back its project changes. Preserve inherited stdin, stdout, and stderr. Pinning
makes the handoff inspectable and repeatable; it does not promise identical output from different
machines or starting project states.

## Catalog Admission Rules

A tool belongs in the catalog only when all of these are true:

1. An official initializer adds a capability to an existing project.
2. Selecting the tool by itself reaches a valid setup action or an origin-owned prompt.
3. The wrapper does not need to guess a required positional, preset, or project choice.
4. The command is not a check, diagnostic, build, migration, or full application scaffold.
5. Official documentation identifies the exact package and setup command.
6. A focused test proves the exact pinned invocation and the no-after-mutation boundary.
7. The exact built-in allowlist is updated intentionally.

Reject a candidate that needs wrapper-authored configuration to appear complete. A useful upstream
CLI is not automatically a suitable initializer for this catalog.

## One Canonical ID

Every built-in has one kebab-case ID. These values must be identical:

```text
adapter id = src/stacks/<id> = manifest.tool = --<id>
```

Do not add aliases or separate internal names. Paths, generated registry entries, selector groups,
and exports are derived from the canonical ID.

## Start Here

1. Inspect `git status` and preserve unrelated work.
2. Run `yarn new --help`; it is the authoritative scaffold-argument list.
3. Read:
   - `src/core/toolchain-adapter.ts`
   - `src/core/toolchain-catalog.ts`
   - `src/core/cli-command-manifest.ts`
   - `src/core/cli-surface.ts`
   - `src/core/execution-plan.ts`
   - `src/core/execute-plan.ts`
   - `scripts/new-toolchain.ts`
   - `scripts/update-cli-manifests.ts`
   - the nearest adapter and its focused test
4. Verify the exact initializer in official documentation and current package help.
5. Run the origin command in a clean representative project when practical. Observe its prompts,
   mutations, and exit behavior without replacing them with wrapper policy.

## Scaffold from the Canonical ID

Pass known scaffold decisions in one command instead of entering the scaffold prompt:

```bash
yarn new example \
  --label "Example" \
  --summary "Initialize Example project configuration" \
  --area quality \
  --provides linting \
  --order 40 \
  --package create-example \
  --command init \
  --docs-url https://example.com/docs/cli \
  --docs-confidence high \
  --docs-reason "The adapter runs the documented initializer unchanged." \
  --docs-section "CLI setup" \
  --docs-must-contain "create-example init" \
  --docs-check "Confirm this remains the complete official initializer."
```

Repeat `--provides` when the initializer supplies more than one capability. The scaffold derives the
stack directory, registry identity, selector, and export from `example`.

The generated adapter follows this model:

```ts
export const example = defineToolchain({
  id: "example",
  label: "Example",
  summary: "Initialize Example project configuration",
  area: "quality",
  capabilities: ["linting"],
  order: 40,
  origin: {
    package: "create-example",
    command: "init",
    docs: [
      {
        url: "https://example.com/docs/cli",
        confidence: "high",
        review: {
          reason: "The adapter runs the documented initializer unchanged.",
          files: ["src/stacks/example/adapter.ts", "src/stacks/example/init.test.ts"],
          sections: ["CLI setup"],
          mustContain: ["create-example init"],
          checks: ["Confirm this remains the complete official initializer."],
        },
      },
    ],
  },
});
```

Use `origin.subcommand`, `origin.commandArgs`, or `origin.runner` only when they are stable parts of
the documented command identity:

- `subcommand: null` suppresses an inferred subcommand.
- `commandArgs` contains documented static tokens in their exact order.
- A custom `runner` declares exact package-manager templates. Its template keys are the supported
  package managers for that tool.

Do not put user preferences, inferred defaults, or convenience presets in command identity.

## Preserve the Origin Argument Surface

Namespaced options select which origin receives each token:

```bash
toolchains-init --example --example.template=react --example.force
```

Core removes only `example.` and preserves the remaining token syntax and order. Do not validate
option names, value types, enum members, repetitions, or upstream support in a handwritten parser.
Unknown namespaced options are accepted immediately. Manifest discovery controls focused help, not
parsing.

Repeat `--<id>.raw.arg=<token>` for positionals, `--`, dash-prefixed values, or complete
token-by-token passthrough:

```bash
toolchains-init \
  --example \
  --example.raw.arg=./packages/app \
  --example.raw.arg=--tag \
  --example.raw.arg=one \
  --example.raw.arg=--tag \
  --example.raw.arg=two
```

Raw tokens retain their order and reach only the selected origin. They are an escape hatch for
upstream syntax, never adapter-owned policy.

## Keep Manifest v1 Generated

`manifest.generated.json` remains the source of truth for changing upstream data:

- the canonical `tool` ID;
- the pinned package version;
- exact package-manager executable and argument templates;
- flag names discovered for focused help;
- documentation provenance and review results.

The handwritten adapter owns stable catalog identity, capabilities, order, origin package and
command identity, and review evidence. Never copy discovered flags into source or teach the wrapper
their value types.

If an invocation is wrong, update the adapter metadata or generator and run
`yarn manifests:update`. Never patch generated JSON by hand. Inspect every generated diff and ensure
`manifest.tool` still equals the adapter ID.

## Build One Plan

All selected tools must resolve into a complete plan before an origin process starts. The printed
plan and executor consume the same structured command data; never print a shell string and parse it
back for execution.

For each planned command, preserve and test:

- tool ID and display label;
- resolved target working directory;
- package manager and pinned origin version;
- exact executable and ordered argument array;
- official documentation source;
- catalog order.

Capabilities are curation metadata. Multiple selected tools that provide `formatting` or `linting`
may produce an informational warning. A warning must not reject a selection, change command order,
or rewrite origin arguments.

Execution is sequential in displayed order. Stop on the first failed command, do not start later
commands, preserve an exact numeric exit code, and re-raise a terminating signal when Node can do
so safely. For Node-reserved or ignored signals such as `SIGUSR1` and `SIGPIPE`, return the
conventional `128 + signal` nonzero status. Leave all completed or partial project changes
untouched.

## Test the Boundary

The focused adapter test must prove:

- canonical ID, area, capabilities, and origin metadata;
- exact working directory, package-manager binary, pinned package, and ordered arguments;
- documented static tokens in their exact positions;
- namespaced and raw user tokens forwarded without reinterpretation;
- exactly one handoff to the origin execution boundary;
- absence of adapter-owned pre-run, post-run, or project-mutation hooks.

Core plan, executor, and run-command tests separately prove:

- plan resolution completes before any process starts;
- the same structured command is printed and executed;
- the origin process inherits stdin, stdout, and stderr;
- overlap warnings are informational only;
- command A succeeds, command B fails, and command C never starts;
- completed changes are not rolled back;
- exact exit-code propagation, safe signal re-raising, and the documented reserved-signal fallback.

A real clean-project smoke test is useful additional evidence. Assertions about origin-produced
files prove that the command ran; they never authorize the wrapper to create or amend those files.

## Keep Command Identity Docs-Backed

Every static command token and custom runner template needs an official source and actionable review
metadata:

- `reason` explains what the source proves.
- `files` names the adapter and focused test.
- `mustContain` proves the documented command still exists.
- `checks` asks a maintainer to verify the complete invocation and origin-ownership boundary.
- `sections` identifies the relevant human-facing documentation area when useful.

Prefer official setup documentation, then official package documentation, then the upstream raw
README or source. Do not weaken a failed marker merely to make automation green; investigate whether
the official initializer changed or no longer qualifies for the catalog.

After metadata changes, run `yarn manifests:update` and inspect generated diffs. Accept unrelated
routine metadata only when it belongs in the requested change.

## Review an Automated Manifest PR

1. Confirm changes are limited to generated manifests and the automation changeset.
2. For version, command-template, or discovered-help drift, run manifest validation and focused
   tests without editing stable adapter identity.
3. Treat removed or renamed discovered flags as focused-help changes only; opaque parsing still
   accepts unknown namespaced options.
4. Review handwritten files only when origin command identity, capability curation, docs evidence,
   or an exact-command test must change.
5. Confirm the printed plan still matches the structured command executed.
6. Confirm no wrapper project mutation occurs before or after the origin process.

An existing adapter should otherwise remain untouched during a routine upstream metadata refresh.

## Expected Change Set

A new built-in normally includes:

- `src/stacks/<id>/adapter.ts`
- `src/stacks/<id>/index.ts`
- `src/stacks/<id>/init.test.ts`
- `src/stacks/<id>/manifest.ts`
- `src/stacks/<id>/manifest.generated.json`
- generated registry files from `yarn manifests:update`
- the exact built-in allowlist update
- user-facing catalog documentation
- a changeset

Change core planning or execution only when the documented invocation cannot use the existing
origin model. Do not special-case one tool in the parser.

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

Review the final diff for canonical identity, init-only catalog fit, generated-file ownership,
exact origin invocation, ordered opaque passthrough, complete plan output, inherited stdio, and
absence of wrapper project mutation. Repeat independent review and fixes until no P1 or P2 findings
remain.
