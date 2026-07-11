import { defineToolchain } from "../../core/toolchain-adapter";

export const cspell = defineToolchain({
  feature: "cspell",
  label: "CSpell",
  catalog: "quality",
  order: 80,
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
  hint: "Spell checking for source code and documentation",
  managedCli: true,
});
