import { defineToolchain } from "../../core/toolchain-adapter";

export const cspell = defineToolchain({
  feature: "cspell",
  label: "CSpell",
  catalog: "quality",
  order: 80,
  package: "cspell",
  command: "init",
  managedCli: {
    phase: "run",
    blocked: {
      stdout: "Standard-output mode does not initialize a CSpell config file.",
    },
  },
  docs: [
    {
      url: "https://raw.githubusercontent.com/streetsidesoftware/cspell/main/packages/cspell/src/commandInit.ts",
      confidence: "medium",
      review: {
        reason:
          "Adapter runs the official CSpell config initializer, tracks each built-in format, and leaves dictionary and locale choices to the user.",
        files: ["src/stacks/cspell/adapter.ts", "src/stacks/cspell/init.test.ts"],
        sections: ["commandInit"],
        mustContain: ["Initialize a CSpell configuration file."],
        checks: [
          "Confirm cspell init still creates a configuration file without stdin.",
          "Confirm yaml, yml, json, and jsonc still map to the declared target filenames.",
          "Confirm --stdout exits without creating a configuration file.",
        ],
      },
    },
  ],
  hint: "Spell checking for source code and documentation",
  packageManagers: ["npm", "pnpm", "yarn", "bun"],
  targetFiles() {
    return ["cspell.config.yaml", "cspell.config.yml", "cspell.json", "cspell.jsonc"];
  },
});
