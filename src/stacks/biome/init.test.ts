import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { biome, biomeCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: biome,
  expectedMetadata: {
    id: "biome",
    area: "quality",
    capabilities: ["formatting", "linting"],
    origin: { package: "@biomejs/biome", command: "init" },
  },
  manifest: biomeCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`@biomejs/biome@${biomeCliManifest.version}`, "init"],
  },
  runCommandMock: mocks.runCommand,
});
