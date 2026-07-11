---
"toolchains-init": patch
---

Add direct `--<tool>` selection and manifest-generated `--<tool>.<flag>` arguments, along with package-manager overrides, focused help, and side-effect-free validation for non-interactive CLI setup. `--yes` now exits early when a selected official initializer still requires interaction instead of entering that initializer's prompts.

Require explicit direct selectors for unattended runs. Selection and router mode use only the generated tool namespace; no parallel `--toolchains` or global `--router` compatibility surface is included.

Make new CLI-backed adapters run through a shared manifest resolver and require docs-backed interaction classification. Routine upstream argument additions now update generated help and parsing without handwritten parser or adapter edits; adapter review remains limited to stable policy contracts, docs markers, focused smoke failures, or an initializer that no longer executes.
