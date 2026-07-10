import { describe, expect, it } from "vitest";
import { renderCliManifestPrBody } from "../scripts/render-cli-manifest-pr-body";

describe("CLI manifest PR body", () => {
  it("keeps routine generated changes separate from explicit adapter review triggers", async () => {
    const body = await renderCliManifestPrBody();

    expect(body).toContain(
      "Routine package version, command template, and unused flag metadata changes do not require handwritten adapter edits.",
    );
    expect(body).toContain(
      "Review an adapter only when the `Docs-backed adapter review required` section below names it, an adapter test fails, or the upstream CLI no longer runs.",
    );
    expect(body).toContain("- yarn verify");
  });
});
