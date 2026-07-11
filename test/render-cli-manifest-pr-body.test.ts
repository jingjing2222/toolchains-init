import { describe, expect, it } from "vitest";
import { renderCliManifestPrBody } from "../scripts/render-cli-manifest-pr-body";

describe("CLI manifest PR body", () => {
  it("keeps routine generated changes separate from explicit adapter review triggers", async () => {
    const body = await renderCliManifestPrBody();

    expect(body).toContain(
      "Routine package version, command template, and additive generated flag changes do not require handwritten parser or adapter edits.",
    );
    expect(body).toContain(
      "Review handwritten adapter policy only when a consumed or required flag contract changes, the docs section below names it, focused verification fails, or the upstream CLI no longer runs.",
    );
    expect(body).toContain("- yarn verify");
  });
});
