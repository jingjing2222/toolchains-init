import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { oxfmt, oxfmtCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: oxfmt,
  expectedMetadata: {
    id: "oxfmt",
    area: "quality",
    capabilities: ["formatting"],
    origin: { package: "oxfmt", command: "init" },
  },
  manifest: oxfmtCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`oxfmt@${oxfmtCliManifest.version}`, "--init"],
  },
  runCommandMock: mocks.runCommand,
});
