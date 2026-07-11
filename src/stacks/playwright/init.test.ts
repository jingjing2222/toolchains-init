import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { playwright, playwrightCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: playwright,
  expectedMetadata: {
    id: "playwright",
    area: "testing",
    capabilities: ["e2e-testing"],
    origin: { package: "create-playwright", command: "init" },
  },
  manifest: playwrightCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npm",
    args: ["init", `playwright@${playwrightCliManifest.version}`, "--"],
  },
  runCommandMock: mocks.runCommand,
});
