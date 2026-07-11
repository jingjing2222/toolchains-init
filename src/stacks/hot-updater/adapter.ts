import { defineToolchain } from "../../core/toolchain-adapter";

export const hotUpdater = defineToolchain({
  id: "hot-updater",
  label: "Hot Updater",
  summary: "Self-hostable OTA update solution for React Native",
  area: "app",
  capabilities: ["mobile-ota"],
  order: 15,
  origin: {
    package: "hot-updater",
    command: "init",
    docs: [
      {
        url: "https://hot-updater.dev/docs/get-started/basic-usage",
        confidence: "high",
        review: {
          reason: "Adapter executes the documented hot-updater init command unchanged.",
          files: ["src/stacks/hot-updater/adapter.ts", "src/stacks/hot-updater/init.test.ts"],
          sections: ["Basic Usage", "Initialize Hot Updater"],
          mustContain: ["npx hot-updater init"],
          checks: ["Confirm hot-updater init remains the official initialization command."],
        },
      },
    ],
  },
});
