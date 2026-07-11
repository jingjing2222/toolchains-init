import { defineToolchain } from "../../core/toolchain-adapter";

export const biome = defineToolchain({
  id: "biome",
  label: "Biome",
  summary: "Formatter and linter setup through Biome CLI",
  area: "quality",
  capabilities: ["formatting", "linting"],
  order: 50,
  origin: {
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
  },
});
