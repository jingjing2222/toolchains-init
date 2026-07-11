import { defineToolchain } from "../../core/toolchain-adapter";

export const cspell = defineToolchain({
  id: "cspell",
  label: "CSpell",
  summary: "Spell checking for source code and documentation",
  area: "quality",
  capabilities: ["spell-checking"],
  order: 80,
  origin: {
    package: "cspell",
    command: "init",
    docs: [
      {
        url: "https://raw.githubusercontent.com/streetsidesoftware/cspell/main/packages/cspell/src/commandInit.ts",
        confidence: "medium",
        review: {
          reason: "Adapter executes the documented cspell init command unchanged.",
          files: ["src/stacks/cspell/adapter.ts", "src/stacks/cspell/init.test.ts"],
          sections: ["commandInit"],
          mustContain: ["Initialize a CSpell configuration file."],
          checks: ["Confirm cspell init remains the configuration initializer."],
        },
      },
    ],
  },
});
