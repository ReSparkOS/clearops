import { describe, expect, it } from "vitest";

import { buildUploadStatusMessage, readUploadResponse } from "./upload-response";

describe("readUploadResponse", () => {
  it("parses successful upload JSON responses", async () => {
    const response = Response.json({
      processed: 1,
      status: "saved",
      mode: "openai",
      flags: 2,
      warnings: ["Could not store contract.pdf: Bucket not found"],
    });

    await expect(readUploadResponse(response)).resolves.toEqual({
      processed: 1,
      status: "saved",
      mode: "openai",
      flags: 2,
      warnings: ["Could not store contract.pdf: Bucket not found"],
    });
  });

  it("returns a useful error for empty non-JSON responses", async () => {
    const response = new Response("", { status: 500 });

    await expect(readUploadResponse(response)).resolves.toEqual({
      error: "Upload failed with status 500.",
    });
  });

  it("returns response text when the server sends non-JSON content", async () => {
    const response = new Response("Internal server error", { status: 500 });

    await expect(readUploadResponse(response)).resolves.toEqual({
      error: "Internal server error",
    });
  });

  it("builds a success message from a saved response", () => {
    expect(
      buildUploadStatusMessage({ processed: 2, status: "saved", mode: "openai", flags: 15 }),
    ).toBe("Processed 2 file(s) and saved 15 review flag(s).");
  });
});
