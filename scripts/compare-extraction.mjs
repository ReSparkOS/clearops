// Compares extraction accuracy between providers by re-running the SAME stored packet
// through each model and diffing the saved results.
//
// Usage (dev server must be running):
//   node --env-file=.env.local scripts/compare-extraction.mjs <transactionId> [baseUrl]
//
// Each rerun replaces the saved extraction, so after this script finishes the database
// holds the results of the LAST provider run (anthropic).
import { createClient } from "@supabase/supabase-js";

// .env.local has a UTF-8 BOM; node --env-file keeps it on the first key name.
const env = (name) => process.env[name] ?? process.env[`\uFEFF${name}`];

const transactionId = process.argv[2];
const baseUrl = process.argv[3] ?? "http://localhost:3000";

if (!transactionId) {
  console.error("Usage: node --env-file=.env.local scripts/compare-extraction.mjs <transactionId> [baseUrl]");
  process.exit(1);
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const secretKey = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !secretKey) {
  console.error("Missing Supabase admin env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY).");
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const PROVIDERS = [
  { provider: "openai", label: env("OPENAI_MODEL") ?? "gpt-5.5" },
  { provider: "anthropic", label: env("ANTHROPIC_MODEL") ?? "claude-fable-5" },
];

const COMPARE_FIELDS = [
  "property_address",
  "buyer_names",
  "seller_names",
  "purchase_price",
  "closing_date",
  "financing_type",
  "cash_or_financed",
  "earnest_money_amount",
  "earnest_money_due_date",
  "inspection_deadline",
  "inspection_resolution_deadline",
  "title_objection_deadline",
  "possession_terms",
  "home_warranty_terms",
  "seller_concessions",
  "property_year_built",
  "lead_based_paint_required",
  "signatures_detected",
  "initials_detected",
];

async function runProvider({ provider, label }) {
  process.stdout.write(`Re-running extraction with ${label} (${provider})... `);
  const started = Date.now();

  const response = await fetch(`${baseUrl}/api/transactions/${transactionId}/rerun`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  const data = await response.json().catch(() => ({}));
  const durationMs = Date.now() - started;

  if (!response.ok || data.status !== "saved") {
    throw new Error(`${label} rerun failed: ${data.error ?? `HTTP ${response.status}`}`);
  }
  console.log(`done in ${(durationMs / 1000).toFixed(1)}s (${data.flags} flags).`);

  const [{ data: extraction }, { data: flags }] = await Promise.all([
    supabase
      .from("extracted_transaction_fields")
      .select("extracted_fields")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("packet_flags")
      .select("title, severity, category")
      .eq("transaction_id", transactionId)
      .order("title"),
  ]);

  return {
    label,
    durationMs,
    facts: extraction?.extracted_fields ?? {},
    flags: flags ?? [],
  };
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function clip(text, width) {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text;
}

function severityCounts(flags) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const flag of flags) counts[flag.severity] = (counts[flag.severity] ?? 0) + 1;
  return `${flags.length} total (high ${counts.high} / med ${counts.medium} / low ${counts.low})`;
}

const results = [];
for (const target of PROVIDERS) {
  results.push(await runProvider(target));
}
const [openai, anthropic] = results;

const COL = 36;
console.log("");
console.log("=== Extracted facts ===");
console.log(`${"Field".padEnd(30)} ${openai.label.padEnd(COL)} ${anthropic.label.padEnd(COL)} Agree`);
console.log("-".repeat(30 + COL * 2 + 8));

let agreements = 0;
for (const field of COMPARE_FIELDS) {
  const left = formatValue(openai.facts[field]);
  const right = formatValue(anthropic.facts[field]);
  const agree = left === right;
  if (agree) agreements += 1;
  console.log(
    `${field.padEnd(30)} ${clip(left, COL).padEnd(COL)} ${clip(right, COL).padEnd(COL)} ${agree ? "yes" : "NO"}`,
  );
}
console.log(`\nField agreement: ${agreements}/${COMPARE_FIELDS.length}`);

console.log("\n=== Review flags ===");
console.log(`${openai.label}:    ${severityCounts(openai.flags)}`);
console.log(`${anthropic.label}: ${severityCounts(anthropic.flags)}`);

const openaiTitles = new Set(openai.flags.map((flag) => flag.title));
const anthropicTitles = new Set(anthropic.flags.map((flag) => flag.title));
const onlyOpenai = [...openaiTitles].filter((title) => !anthropicTitles.has(title));
const onlyAnthropic = [...anthropicTitles].filter((title) => !openaiTitles.has(title));

if (onlyOpenai.length) {
  console.log(`\nFlags only raised by ${openai.label}:`);
  for (const title of onlyOpenai) console.log(`  - ${title}`);
}
if (onlyAnthropic.length) {
  console.log(`\nFlags only raised by ${anthropic.label}:`);
  for (const title of onlyAnthropic) console.log(`  - ${title}`);
}
if (!onlyOpenai.length && !onlyAnthropic.length) {
  console.log("\nBoth models raised the same set of flags.");
}

console.log(`\nTiming: ${openai.label} ${(openai.durationMs / 1000).toFixed(1)}s · ${anthropic.label} ${(anthropic.durationMs / 1000).toFixed(1)}s`);
console.log(`Note: the saved extraction now reflects the last run (${anthropic.label}).`);
console.log("Accuracy ground truth: verify disagreeing fields against the source PDF — agreement alone doesn't prove correctness.");
