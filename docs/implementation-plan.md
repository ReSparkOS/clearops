# Clear Close IQ MVP Implementation Plan

## Goal

Build a standalone Next.js MVP that uploads real estate packet PDFs, runs server-side extraction, applies deterministic Missouri residential rules, and displays a Packet Health Check report.

## Scope

- Use demo mode when Supabase, OpenAI, or PDF parsing is not configured.
- Keep integrations out of scope.
- Use AI only for document classification and structured extraction.
- Use rules code for packet requirements, risk flags, deadlines, and confidence-aware review statuses.

## Build Order

1. Scaffold Next.js, TypeScript, Tailwind, and tests.
2. Add domain types and Zod schemas for documents, transaction facts, flags, deadlines, and extraction results.
3. Write failing tests for Missouri rules and extraction contracts.
4. Implement the deterministic rules engine and demo extraction fallback.
5. Add Supabase SSR/client helpers, storage upload, and database persistence adapters.
6. Build `/login`, `/dashboard`, `/transactions/new`, `/transactions/[id]`, `/transactions/[id]/upload`, `/transactions/[id]/health-check`, and `/settings/rules`.
7. Add API routes for transaction listing/creation, packet upload, extraction re-run, and flag status updates.
8. Add schema SQL for Supabase tables, RLS policies, and storage bucket.
9. Verify with tests, lint, build, and a local browser pass.
