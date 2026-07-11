import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { cspell, cspellCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: cspell,
  expectedMetadata: {
    id: "cspell",
    area: "quality",
    capabilities: ["spell-checking"],
    origin: { package: "cspell", command: "init" },
  },
  manifest: cspellCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`cspell@${cspellCliManifest.version}`, "init"],
  },
  runCommandMock: mocks.runCommand,
});
