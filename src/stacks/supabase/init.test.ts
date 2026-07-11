import { vi } from "vitest";
import { defineFocusedInitContract } from "../init-test-contract";
import { supabase, supabaseCliManifest } from "./index";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn(async () => {}) }));

vi.mock("../../core/run-command", () => ({ runCommand: mocks.runCommand }));

defineFocusedInitContract({
  toolchain: supabase,
  expectedMetadata: {
    id: "supabase",
    area: "app",
    capabilities: ["local-backend"],
    origin: { package: "supabase", command: "init" },
  },
  manifest: supabaseCliManifest,
  packageManager: "npm",
  baseCommand: {
    bin: "npx",
    args: [`supabase@${supabaseCliManifest.version}`, "init"],
  },
  runCommandMock: mocks.runCommand,
});
