import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { yarnSdks, yarnSdksCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: yarnSdks,
  expectedMetadata: {
    id: "yarn-sdks",
    area: "editor",
    capabilities: ["editor-sdks"],
    origin: { package: "@yarnpkg/sdks", command: "vscode" },
  },
  manifest: yarnSdksCliManifest,
  packageManager: "yarn",
  baseCommand: {
    bin: "yarn",
    args: ["dlx", `@yarnpkg/sdks@${yarnSdksCliManifest.version}`, "vscode"],
  },
  runCommandMock: mocks.runCommand,
});
