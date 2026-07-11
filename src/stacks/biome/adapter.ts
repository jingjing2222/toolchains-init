import { defineToolchain } from "../../core/toolchain-adapter";

export const biome = defineToolchain({
  feature: "biome",
  label: "Biome",
  hint: "Formatter and linter setup through Biome CLI",
  catalog: "quality",
  order: 50,
  package: "@biomejs/biome",
  command: "init",
  docs: [
    {
      url: "https://biomejs.dev/guides/getting-started/",
      confidence: "high",
      review: {
        reason: "Adapter executes the documented biome init command unchanged.",
        files: ["src/stacks/biome/adapter.ts", "src/stacks/biome/init.test.ts"],
        sections: ["Configuration"],
        mustContain: ["npx @biomejs/biome init"],
        checks: ["Confirm biome init remains the project configuration initializer."],
      },
    },
  ],
  managedCli: true,
});
