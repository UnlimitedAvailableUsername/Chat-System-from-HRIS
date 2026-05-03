-- ============================================================================
-- AI Features — Audit & Analytics
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER migration.sql.
-- ============================================================================

-- AI audit log: every AI draft generated, and what the admin did with it.
create table if not exists public.xin_ai_audit (
  audit_id         bigserial primary key,
  employee_id      bigint not null,          -- whose chat triggered this
  admin_user_id    bigint,                   -- which admin acted on it (null = auto-triggered)
  prompt_summary   text not null,            -- short description of what was sent to AI
  ai_draft         text not null,            -- the AI's draft reply
  action           text not null check (action in ('accepted', 'edited', 'rejected')),
  final_message    text,                     -- what was actually sent (null if rejected)
  confidence       text not null,            -- low / medium / high
  confidence_score int,                      -- 0-100 numeric score
  created_at       timestamptz not null default now()
);

create index if not exists idx_ai_audit_employee_id    on public.xin_ai_audit(employee_id);
create index if not exists idx_ai_audit_admin_user_id  on public.xin_ai_audit(admin_user_id);
create index if not exists idx_ai_audit_action         on public.xin_ai_audit(action);

-- RLS: same permissive policy as the rest of the sandbox
alter table public.xin_ai_audit enable row level security;
drop policy if exists "anon_all" on public.xin_ai_audit;
create policy "anon_all" on public.xin_ai_audit for all using (true) with check (true);

-- Enable realtime for the audit table (optional, useful for a live dashboard)
alter publication supabase_realtime add table public.xin_ai_audit;