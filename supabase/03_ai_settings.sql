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
