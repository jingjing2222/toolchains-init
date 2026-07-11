import { defineToolchain } from "../../core/toolchain-adapter";

export const supabase = defineToolchain({
  feature: "supabase",
  label: "Supabase",
  catalog: "app",
  order: 18,
  package: "supabase",
  command: "init",
  docs: [
    {
      url: "https://supabase.com/docs/reference/cli/v0/supabase-init",
      confidence: "high",
      review: {
        reason: "Adapter executes the official supabase init command unchanged.",
        files: ["src/stacks/supabase/adapter.ts", "src/stacks/supabase/init.test.ts"],
        sections: ["supabase init"],
        mustContain: ["supabase init [flags]"],
        checks: ["Confirm supabase init remains the official local-project initializer."],
      },
    },
  ],
  hint: "Local Supabase project configuration",
  managedCli: true,
});
