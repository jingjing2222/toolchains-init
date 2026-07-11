import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { prisma, prismaCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: prisma,
  expectedMetadata: {
    id: "prisma",
    area: "app",
    capabilities: ["database-orm"],
    origin: { package: "prisma", command: "init" },
  },
  manifest: prismaCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`prisma@${prismaCliManifest.version}`, "init"],
  },
  runCommandMock: mocks.runCommand,
});
