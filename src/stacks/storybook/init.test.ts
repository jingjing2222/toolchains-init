import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { storybook, storybookCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: storybook,
  expectedMetadata: {
    id: "storybook",
    area: "testing",
    capabilities: ["component-workshop"],
    origin: { package: "create-storybook", command: "init" },
  },
  manifest: storybookCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npm",
    args: ["init", `storybook@${storybookCliManifest.version}`, "--"],
  },
  runCommandMock: mocks.runCommand,
});
