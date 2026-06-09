# Clear Close IQ

Clear Close IQ is a local-first MVP for intelligent real estate transaction coordination. It classifies uploaded packet PDFs, extracts transaction facts with OpenAI structured outputs, runs a deterministic rules engine, and renders a health-check report with critical/warning/info flags.

## Run Locally

```bash
npm install
npm run dev -- --port 3000
```

Open `http://localhost:3000/dashboard`.

## Environment

Create `.env.local` from `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SUPABASE_STORAGE_BUCKET=packet-documents
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
```

Current behavior:

- OpenAI extraction runs when `OPENAI_API_KEY` is present.
- Supabase Auth, Storage, and persistence run when the Supabase URL plus public and secret keys are present.
- Demo mode remains available when Supabase or OpenAI is not configured.

## Supabase

Apply `supabase/schema.sql` in the Supabase SQL editor for the project. It creates the packet-audit tables, storage bucket policy, audit log, notes, and RLS policies.

The configured storage bucket name is `packet-documents`.

## Verification

```bash
npm test
npm run lint
npm run build
```

The test suite covers the Missouri residential rule engine and extraction fallback behavior.
