import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { changesets, changesetsCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: changesets,
  expectedMetadata: {
    id: "changesets",
    area: "release",
    capabilities: ["versioning"],
    origin: { package: "@changesets/cli", command: "init" },
  },
  manifest: changesetsCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`@changesets/cli@${changesetsCliManifest.version}`, "init"],
  },
  runCommandMock: mocks.runCommand,
});
