-- AI Features Audit Logging
create table if not exists public.xin_ai_audit (
  audit_id        bigserial primary key,
  admin_user_id   bigint references public.xin_employees(user_id),
  employee_id     bigint references public.xin_employees(user_id),
  prompt          text not null,
  ai_response     text not null,
  action          text check (action in ('accepted', 'edited', 'rejected')),
  final_message   text,
  confidence      float,
  citations       jsonb,
  created_at      timestamptz not null default now()
);

-- Add AI tracking to messages
alter table public.xin_employee_messages 
add column if not exists is_ai_assisted boolean default false,
add column if not exists ai_original_content text;

-- Enable RLS for the audit table (simple policy for demo)
alter table public.xin_ai_audit enable row level security;

create policy "Admins can do everything with AI audit" on public.xin_ai_audit
  for all using (true) with check (true);
