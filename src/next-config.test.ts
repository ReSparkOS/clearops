import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("Next.js server package configuration", () => {
  it("keeps pdf-parse external so PDF.js workers resolve during packet uploads", () => {
    expect(nextConfig.serverExternalPackages ?? []).toContain("pdf-parse");
  });
});
