-- 1. AI AUDIT TABLE ----------------------------------------------------------
-- Logs every AI suggestion: what was sent, what came back, and what the admin
-- did with it (accepted / edited / rejected).

create table if not exists public.xin_ai_audit (
  audit_id          bigserial primary key,
  employee_id       bigint not null,
  admin_user_id     bigint,
  prompt_sent       text not null,
  ai_response       text not null,
  admin_action      text check (admin_action in ('accepted', 'edited', 'rejected')),
  final_message     text,
  created_at        timestamptz not null default now(),
  acted_at          timestamptz
);

create index if not exists idx_ai_audit_employee_id    on public.xin_ai_audit(employee_id);
create index if not exists idx_ai_audit_admin_user_id  on public.xin_ai_audit(admin_user_id);
create index if not exists idx_ai_audit_admin_action   on public.xin_ai_audit(admin_action);

-- 2. ROW-LEVEL SECURITY ------------------------------------------------------
alter table public.xin_ai_audit enable row level security;

drop policy if exists "anon_all" on public.xin_ai_audit;
create policy "anon_all" on public.xin_ai_audit
  for all using (true) with check (true);
