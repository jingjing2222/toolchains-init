---
"toolchains-init": patch
---

Detect Yarn PnP projects from target project files so oxlint schema cleanup and Yarn SDK setup run correctly when using `yarn dlx`.

Change the interactive prompt defaults so no toolchains are preselected.

Keep TanStack Router setup changes scoped to dependency fields in package.json, and only preserve dependencies newly added by the official CLI.
