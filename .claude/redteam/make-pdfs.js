// Generates minimal valid PDFs for red-team testing. Synthetic data only.
const fs = require("fs");

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Build a simple multi-page PDF with Helvetica text lines per page.
function makePdf(pagesLines) {
  const pageCount = pagesLines.length;
  const fontObjNum = 3 + pageCount * 2;
  const pageObjNums = [];
  for (let i = 0; i < pageCount; i++) pageObjNums.push(3 + i * 2);

  const objects = [];
  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageCount} >>\nendobj\n`;

  pagesLines.forEach((lines, i) => {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    let stream = "BT /F1 11 Tf 50 750 Td 14 TL\n";
    for (const line of lines) {
      stream += `(${esc(line)}) Tj T*\n`;
    }
    stream += "ET";
    objects[pageNum] = `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>\nendobj\n`;
    objects[contentNum] = `${contentNum} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`;
  });

  objects[fontObjNum] = `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let n = 1; n <= fontObjNum; n++) {
    offsets[n] = Buffer.byteLength(pdf);
    pdf += objects[n];
  }
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${fontObjNum + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= fontObjNum; n++) {
    pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${fontObjNum + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// 1. tiny.pdf — valid PDF, almost no text (proxy for scanned-image-only)
fs.writeFileSync("tiny.pdf", makePdf([["Scan001"]]));

// 2. contract.pdf — synthetic Missouri contract, OBVIOUSLY fake parties
const contractPages = [
  [
    "MISSOURI RESIDENTIAL SALE CONTRACT (SYNTHETIC TEST DOCUMENT)",
    "THIS IS SYNTHETIC TEST DATA FOR SOFTWARE QA. NOT A REAL TRANSACTION.",
    "Property: 999 Synthetic Test Blvd, Testville, MO 65000",
    "Buyer: Testy QA-Buyer and Sample QA-Buyer",
    "Seller: Fake QA-Seller",
    "Purchase Price: $123,456",
    "Earnest Money: $1,000 due within 5 days after Effective Date",
    "Closing Date: June 30, 2026",
    "Financing: Conventional loan of $100,000",
    "Inspection Deadline: June 12, 2026",
    "Title Objection Deadline: June 18, 2026",
    "Year Built: 1970",
    "Exhibit A (Legal Description) is attached and incorporated.",
    "Lead-Based Paint Disclosure is attached.",
  ],
  [
    "PAGE 2 - SIGNATURES (SYNTHETIC TEST DOCUMENT)",
    "Buyer signature: signed 06/05/2026",
    "Seller signature: signed 06/05/2026",
    "Seller agrees to provide a home warranty up to $500.",
    "Personal property included: kitchen refrigerator.",
  ],
];
fs.writeFileSync("contract.pdf", makePdf(contractPages));

// 3. big.pdf — 60 pages
const bigPages = [];
for (let p = 1; p <= 60; p++) {
  const lines = [`SYNTHETIC FILLER DOCUMENT PAGE ${p} OF 60 (SOFTWARE QA TEST)`];
  for (let l = 0; l < 40; l++) {
    lines.push(`Filler clause ${p}.${l}: the parties agree this is synthetic QA filler text.`);
  }
  bigPages.push(lines);
}
fs.writeFileSync("big.pdf", makePdf(bigPages));

console.log("created:", fs.readdirSync(".").filter((f) => f.endsWith(".pdf")).map((f) => `${f}=${fs.statSync(f).size}b`).join(", "));