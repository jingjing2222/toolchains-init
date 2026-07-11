import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { shadcn, shadcnCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: shadcn,
  expectedMetadata: {
    id: "shadcn",
    area: "app",
    capabilities: ["ui-components"],
    origin: { package: "shadcn", command: "init" },
  },
  manifest: shadcnCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`shadcn@${shadcnCliManifest.version}`, "init"],
  },
  runCommandMock: mocks.runCommand,
});
