create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.users(id),
  property_address text,
  buyer_names text[] not null default '{}',
  seller_names text[] not null default '{}',
  agent_team text,
  closing_date date,
  purchase_price numeric(14, 2),
  financing_type text,
  packet_status text not null default 'not_uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  filename text not null,
  storage_path text,
  document_type text not null default 'unknown_document',
  classification_confidence numeric(4, 3),
  page_start integer,
  page_end integer,
  status text not null default 'uploaded',
  uploaded_at timestamptz not null default now()
);

create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer not null,
  extracted_text text,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);

create table if not exists public.document_classifications (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  document_type text not null,
  confidence numeric(4, 3) not null,
  source_pages integer[],
  raw_ai_response jsonb,
  schema_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.extracted_transaction_fields (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  schema_version text not null,
  extracted_fields jsonb not null,
  raw_ai_response jsonb,
  confidence numeric(4, 3),
  created_at timestamptz not null default now()
);

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  name text not null,
  deadline_date date,
  source_document_id uuid references public.documents(id),
  source_page integer,
  confidence numeric(4, 3),
  risk_status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.packet_flags (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  category text not null,
  severity text not null,
  title text not null,
  explanation text not null,
  suggested_action text not null,
  status text not null default 'open',
  confidence numeric(4, 3),
  source text not null,
  source_document_id uuid references public.documents(id),
  source_page integer,
  required_document text,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rule_results (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  rule_library text not null,
  rule_version text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  actor_id uuid references public.users(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  author_id uuid references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('packet-documents', 'packet-documents', false)
on conflict (id) do nothing;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.organization_members enable row level security;
alter table public.transactions enable row level security;
alter table public.documents enable row level security;
alter table public.document_pages enable row level security;
alter table public.document_classifications enable row level security;
alter table public.extracted_transaction_fields enable row level security;
alter table public.deadlines enable row level security;
alter table public.packet_flags enable row level security;
alter table public.rule_results enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notes enable row level security;

create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = org_id
      and member.user_id = auth.uid()
  );
$$;

create policy "Users can read their profile"
on public.users for select
using (id = auth.uid());

create policy "Members can read organizations"
on public.organizations for select
using (private.is_org_member(id));

create policy "Members can read memberships"
on public.organization_members for select
using (private.is_org_member(organization_id));

create policy "Members can manage transactions"
on public.transactions for all
using (private.is_org_member(organization_id))
with check (private.is_org_member(organization_id));

create policy "Members can manage transaction documents"
on public.documents for all
using (
  exists (
    select 1 from public.transactions txn
    where txn.id = documents.transaction_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1 from public.transactions txn
    where txn.id = documents.transaction_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can manage document pages"
on public.document_pages for all
using (
  exists (
    select 1
    from public.documents doc
    join public.transactions txn on txn.id = doc.transaction_id
    where doc.id = document_pages.document_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.documents doc
    join public.transactions txn on txn.id = doc.transaction_id
    where doc.id = document_pages.document_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can manage document classifications"
on public.document_classifications for all
using (
  exists (
    select 1
    from public.documents doc
    join public.transactions txn on txn.id = doc.transaction_id
    where doc.id = document_classifications.document_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.documents doc
    join public.transactions txn on txn.id = doc.transaction_id
    where doc.id = document_classifications.document_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can manage extraction artifacts"
on public.extracted_transaction_fields for all
using (
  exists (
    select 1 from public.transactions txn
    where txn.id = extracted_transaction_fields.transaction_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1 from public.transactions txn
    where txn.id = extracted_transaction_fields.transaction_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can manage deadlines"
on public.deadlines for all
using (
  exists (
    select 1 from public.transactions txn
    where txn.id = deadlines.transaction_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1 from public.transactions txn
    where txn.id = deadlines.transaction_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can manage packet flags"
on public.packet_flags for all
using (
  exists (
    select 1 from public.transactions txn
    where txn.id = packet_flags.transaction_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1 from public.transactions txn
    where txn.id = packet_flags.transaction_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can manage rule results"
on public.rule_results for all
using (
  exists (
    select 1 from public.transactions txn
    where txn.id = rule_results.transaction_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1 from public.transactions txn
    where txn.id = rule_results.transaction_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can read audit logs"
on public.audit_logs for select
using (
  organization_id is not null
  and private.is_org_member(organization_id)
);

create policy "Members can insert audit logs"
on public.audit_logs for insert
with check (
  organization_id is not null
  and private.is_org_member(organization_id)
);

create policy "Members can manage notes"
on public.notes for all
using (
  exists (
    select 1 from public.transactions txn
    where txn.id = notes.transaction_id
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  exists (
    select 1 from public.transactions txn
    where txn.id = notes.transaction_id
      and private.is_org_member(txn.organization_id)
  )
);

create policy "Members can access packet storage"
on storage.objects for all
using (
  bucket_id = 'packet-documents'
  and exists (
    select 1
    from public.transactions txn
    where txn.id::text = split_part(storage.objects.name, '/', 1)
      and private.is_org_member(txn.organization_id)
  )
)
with check (
  bucket_id = 'packet-documents'
  and exists (
    select 1
    from public.transactions txn
    where txn.id::text = split_part(storage.objects.name, '/', 1)
      and private.is_org_member(txn.organization_id)
  )
);
