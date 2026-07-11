---
"toolchains-init": minor
---

BREAKING: replace the CLI and catalog with an init-only, plan-first contract. Interactive runs now
select tools, print the complete pinned execution plan, ask for confirmation, and run; explicit
selectors print the plan and run without a wrapper confirmation; `--plan` prints the same plan
without executing an origin CLI. Commands run sequentially in canonical catalog order, stop on the
first failure, and never roll back completed or partial origin changes. Remove the wrapper `--yes`
option.

Remove the non-initializer or incomplete selectors `--tanstack-router`, `--msw`, `--prettier`,
`--knip`, `--react-doctor`, `--publint`, and `--attw`. The retained catalog contains 14 project setup
CLIs.

Unify every built-in tool around one canonical kebab-case ID: the adapter ID, stack directory,
generated manifest `tool`, and `--<tool>` selector are now identical. Adapters declare stable origin
command identity and capabilities; generated manifest v1 files continue to own pinned versions,
package-manager command templates, discovered focused-help flags, and documentation provenance.
Namespaced and raw origin arguments remain opaque and ordered.
