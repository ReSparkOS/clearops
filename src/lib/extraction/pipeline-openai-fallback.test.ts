import { describe, expect, it, vi } from "vitest";

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    async getText() {
      return {
        text: "Residential sale contract packet with enough extractable text for AI processing. ".repeat(20),
      };
    }

    async destroy() {}
  },
}));

vi.mock("openai", () => ({
  default: class {
    responses = {
      parse: vi.fn(async () => {
        throw new Error("model not found");
      }),
    };
  },
}));

describe("runExtractionPipeline OpenAI failure", () => {
  it("returns a failed extraction with the real error and no fabricated data when OpenAI fails", async () => {
    const { runExtractionPipeline } = await import("./pipeline");

    const result = await runExtractionPipeline({
      apiKey: "test-api-key",
      filename: "contract.pdf",
      fileBuffer: Buffer.from("%PDF-1.4"),
      model: "missing-model",
    });

    expect(result.mode).toBe("failed");
    expect(result.error).toContain("AI extraction failed: model not found");
    expect(result.extraction.documents).toEqual([]);
    expect(result.extraction.facts.property_address).toBeNull();
    expect(result.health.flags).toEqual([]);
  });
});
