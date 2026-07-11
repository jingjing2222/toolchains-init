import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { secretlint, secretlintCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: secretlint,
  expectedMetadata: {
    id: "secretlint",
    area: "quality",
    capabilities: ["secret-scanning"],
    origin: { package: "secretlint", command: "init" },
  },
  manifest: secretlintCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`secretlint@${secretlintCliManifest.version}`, "--init"],
  },
  runCommandMock: mocks.runCommand,
});
