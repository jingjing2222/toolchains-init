import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { eslint, eslintCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: eslint,
  expectedMetadata: {
    id: "eslint",
    area: "quality",
    capabilities: ["linting"],
    origin: { package: "@eslint/create-config", command: "init" },
  },
  manifest: eslintCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`@eslint/create-config@${eslintCliManifest.version}`],
  },
  runCommandMock: mocks.runCommand,
});
