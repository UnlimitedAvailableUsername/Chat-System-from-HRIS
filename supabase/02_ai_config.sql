-- ==============================================================================
-- PART 1: AI Settings & Configuration
-- ==============================================================================

create table if not exists public.xin_ai_settings (
  id integer primary key default 1 check (id = 1), 
  provider text not null default 'openai',
  model text not null default 'gpt-5-mini',
  system_prompt text not null default 'You are an HR support assistant.\nHelp the admin draft a helpful, professional, and concise reply to the employee.',
  enable_rag boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.xin_ai_settings enable row level security;

drop policy if exists "anon_all" on public.xin_ai_settings;
create policy "anon_all" on public.xin_ai_settings for all using (true) with check (true);

insert into public.xin_ai_settings (id, provider, model) 
values (1, 'openai', 'gpt-5-mini') 
on conflict (id) do nothing;


-- ==============================================================================
-- PART 2: AI Audit Logging & Message Tracking
-- ==============================================================================

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

alter table public.xin_employee_messages 
add column if not exists is_ai_assisted boolean default false,
add column if not exists ai_original_content text;

alter table public.xin_ai_audit enable row level security;

drop policy if exists "Admins can do everything with AI audit" on public.xin_ai_audit;
create policy "Admins can do everything with AI audit" on public.xin_ai_audit
  for all using (true) with check (true);


-- ==============================================================================
-- PART 3: Knowledge Base & RAG Configuration (No Embeddings)
-- ==============================================================================

drop function if exists match_documents;
drop function if exists search_documents;
drop table if exists public.xin_knowledge_base;

create table public.xin_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.xin_knowledge_base enable row level security;

drop policy if exists "anon_read" on public.xin_knowledge_base;
create policy "anon_read" on public.xin_knowledge_base for select using (true);

create function search_documents (
  search_query text,
  match_count int
)
returns table (
  id uuid,
  title text,
  content text,
  rank real
)
language plpgsql stable
as $$
begin
  return query
  select
    xin_knowledge_base.id,
    xin_knowledge_base.title,
    xin_knowledge_base.content,
    ts_rank(to_tsvector('english', xin_knowledge_base.title || ' ' || xin_knowledge_base.content), websearch_to_tsquery('english', search_query)) as rank
  from public.xin_knowledge_base
  where to_tsvector('english', xin_knowledge_base.title || ' ' || xin_knowledge_base.content) @@ websearch_to_tsquery('english', search_query)
  order by rank desc
  limit match_count;
end;
$$;

insert into public.xin_knowledge_base (title, content) values 
('Payroll and Payout Dates', 'All employees receive their salary bi-monthly. The standard payout dates are the 15th and 30th of every month. The next upcoming payout date for this period is May 15th, 2026. Payslips are available 1 day before the payout.'),
('Company Paid Time Off (PTO) Policy', 'Employees are entitled to 20 days of Paid Time Off per year. PTO does not carry over to the next year. To request PTO, an employee must submit a request via the HRIS portal at least 2 weeks in advance.'),
('Remote Work Policy', 'Employees may work remotely up to 3 days a week. Mandatory in-office days are Tuesday and Wednesday. Employees working remotely must be online and available during core hours (10 AM to 3 PM).');
