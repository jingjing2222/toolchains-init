import { describe, expect, it } from "vitest";
import { renderCliManifestPrBody } from "../scripts/render-cli-manifest-pr-body";

describe("CLI manifest PR body", () => {
  it("explains how generated drift changes plans without changing origin identity", async () => {
    const body = await renderCliManifestPrBody();

    expect(body).toContain(
      "Routine package version, command template, and discovered flag-name changes update the displayed execution plan and origin invocation without handwritten parser edits.",
    );
    expect(body).toContain(
      "Review handwritten origin identity only when the docs section below names it, focused verification fails, or the upstream CLI no longer runs.",
    );
    expect(body).not.toContain("managed CLI");
    expect(body).toContain("- yarn verify");
  });
});
