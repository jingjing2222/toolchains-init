import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { hotUpdater, hotUpdaterCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: hotUpdater,
  expectedMetadata: {
    id: "hot-updater",
    area: "app",
    capabilities: ["mobile-ota"],
    origin: { package: "hot-updater", command: "init" },
  },
  manifest: hotUpdaterCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`hot-updater@${hotUpdaterCliManifest.version}`, "init"],
  },
  runCommandMock: mocks.runCommand,
});
