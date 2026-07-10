---
"toolchains-init": patch
---

Add argument-driven toolchain selection, package-manager overrides, registry-generated help, and side-effect-free validation for non-interactive CLI setup. `--yes` now exits early when a selected official initializer still requires interaction instead of entering that initializer's prompts.

Make new CLI-backed adapters manifest-runnable and require docs-backed interaction classification, while tightening manifest automation so routine upstream metadata refreshes leave handwritten adapters unchanged unless a focused contract check fails.
