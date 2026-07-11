import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { oxlint, oxlintCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: oxlint,
  expectedMetadata: {
    id: "oxlint",
    area: "quality",
    capabilities: ["linting"],
    origin: { package: "oxlint", command: "init" },
  },
  manifest: oxlintCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`oxlint@${oxlintCliManifest.version}`, "--init"],
  },
  runCommandMock: mocks.runCommand,
});
