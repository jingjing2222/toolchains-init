import { defineToolchain } from "../../core/toolchain-adapter";

export const supabase = defineToolchain({
  feature: "supabase",
  label: "Supabase",
  catalog: "app",
  order: 18,
  package: "supabase",
  command: "init",
  managedCli: {
    phase: "run",
    blocked({ yes }) {
      return {
        completions: "Shell completion output does not initialize a Supabase project.",
        workdir: "The initializer always runs in the selected target directory.",
        ...(yes
          ? { interactive: "Interactive IDE prompts cannot run with the global --yes option." }
          : {}),
      };
    },
  },
  docs: [
    {
      url: "https://supabase.com/docs/reference/cli/v0/supabase-init",
      confidence: "high",
      review: {
        reason:
          "Adapter runs the official Supabase local-project initializer in the selected target and blocks completion-only output.",
        files: ["src/stacks/supabase/adapter.ts", "src/stacks/supabase/init.test.ts"],
        sections: ["supabase init"],
        mustContain: ["supabase init [flags]"],
        checks: [
          "Confirm supabase init still creates supabase/config.toml without stdin.",
          "Confirm --completions exits without initializing and --workdir redirects initialization outside the selected target.",
          "Confirm --interactive is allowed only when stdin is inherited.",
        ],
      },
    },
  ],
  hint: "Local Supabase project configuration",
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  targetFiles() {
    return ["supabase/config.toml"];
  },
});
