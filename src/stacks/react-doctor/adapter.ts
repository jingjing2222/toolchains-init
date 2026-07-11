import { defineToolchain } from "../../core/toolchain-adapter";

export const reactDoctor = defineToolchain({
  feature: "reactDoctor",
  label: "React Doctor",
  hint: "React health checks",
  catalog: "quality",
  order: 70,
  package: "react-doctor",
  command: "check",
  docs: [
    {
      url: "https://raw.githubusercontent.com/millionco/react-doctor/main/packages/react-doctor/README.md",
      confidence: "medium",
      review: {
        reason: "Adapter executes the bare React Doctor CLI unchanged.",
        files: ["src/stacks/react-doctor/adapter.ts", "src/stacks/react-doctor/init.test.ts"],
        sections: ["Quick start"],
        mustContain: ["npx react-doctor@latest"],
        checks: ["Confirm the bare react-doctor command remains the general project check."],
      },
    },
  ],
  subcommand: null,
  managedCli: true,
});
