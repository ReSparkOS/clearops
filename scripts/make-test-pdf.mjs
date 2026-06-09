// Generates a small, text-based synthetic contract PDF for extraction testing.
// Usage: node scripts/make-test-pdf.mjs [outPath]
import { writeFileSync } from "node:fs";

const PAGE_1 = [
  "MISSOURI RESIDENTIAL REAL ESTATE SALE CONTRACT (SYNTHETIC TEST DOCUMENT)",
  "",
  "Property Address: 999 Synthetic Test Blvd, Testville, MO 65000",
  "Buyer(s): Testy QA-Buyer and Sample QA-Buyer",
  "Seller(s): Fake QA-Seller",
  "Purchase Price: $123,456.00",
  "Financing: Conventional loan. Buyer to obtain financing.",
  "Earnest Money: $1,000.00 due within 5 days after Effective Date,",
  "to be deposited with the escrow agent.",
  "Closing Date: June 30, 2026",
  "Inspection Deadline: June 12, 2026",
  "Title Objection Deadline: June 18, 2026",
  "Property Year Built: 1962",
  "Home Warranty: Seller agrees to provide a home warranty up to $500.",
  "Personal Property: Refrigerator and washer/dryer are included in the sale.",
  "Exhibit A (Legal Description) is attached and incorporated by reference.",
  "Lead-Based Paint Disclosure to be provided as a separate attachment.",
] .join("\n");

const PAGE_2 = [
  "SIGNATURES (SYNTHETIC TEST DOCUMENT - PAGE 2)",
  "",
  "Buyer signature: ____________________  Date: ______",
  "Seller signature: ___________________  Date: ______",
  "",
  "Inspection resolution deadline to be agreed by the parties.",
  "This synthetic document is for software testing only and is not a real contract.",
].join("\n");

function escapePdfText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pageContentStream(text) {
  const lines = text.split("\n");
  const ops = ["BT", "/F1 11 Tf", "13 TL", "50 760 Td"];
  for (const line of lines) {
    ops.push(`(${escapePdfText(line)}) Tj`, "T*");
  }
  ops.push("ET");
  return ops.join("\n");
}

function buildPdf(pages) {
  // Objects: 1 catalog, 2 pages tree, 3 font, then per page: page object + content stream.
  const objects = [];
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((text, index) => {
    const pageId = pageObjectIds[index];
    const contentId = pageId + 1;
    const stream = pageContentStream(text);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  let body = "%PDF-1.4\n";
  const offsets = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(body, "latin1");
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(body, "latin1");
  const count = objects.length;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  body += `${xref}trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body, "latin1");
}

const outPath = process.argv[2] ?? "data/synthetic-contract.pdf";
writeFileSync(outPath, buildPdf([PAGE_1, PAGE_2]));
console.log(`Wrote ${outPath}`);
