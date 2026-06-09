// End-to-end smoke test of the authenticated API surface using a Bearer token.
// Usage: node --env-file=.env.local scripts/smoke-auth-flow.mjs <email> <password>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
const base = "http://localhost:3000";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) {
  console.error("sign-in failed:", authError.message);
  process.exit(1);
}
const headers = { Authorization: `Bearer ${auth.session.access_token}` };
console.log("1. signed in, got access token");

const createResponse = await fetch(`${base}/api/transactions`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    propertyAddress: "999 Synthetic Test Blvd, Testville, MO 65000",
    buyerNames: ["Testy QA-Buyer", "Sample QA-Buyer"],
    sellerNames: ["Fake QA-Seller"],
    closingDate: "2026-06-30",
    purchasePrice: 123456,
    financingType: "conventional",
  }),
});
const created = await createResponse.json();
if (!createResponse.ok) {
  console.error("create failed:", createResponse.status, created);
  process.exit(1);
}
console.log("2. created transaction", created.id);

const buffer = readFileSync("data/synthetic-contract.pdf");
const form = new FormData();
form.append("files", new File([buffer], "synthetic-contract.pdf", { type: "application/pdf" }));
const uploadResponse = await fetch(`${base}/api/transactions/${created.id}/upload`, {
  method: "POST",
  headers,
  body: form,
});
const uploaded = await uploadResponse.json();
console.log("3. upload:", uploadResponse.status, JSON.stringify(uploaded));

console.log(`\nOpen in browser: ${base}/transactions/${created.id}/health-check`);
