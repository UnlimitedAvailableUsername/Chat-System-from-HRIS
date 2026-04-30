-- ============================================================================
-- Chat Support — Interview Test Schema
-- ============================================================================
-- Paste this entire file into the Supabase SQL Editor and run it once.
-- Project: https://supabase.com/dashboard/project/_/sql/new
-- ============================================================================

-- 1. USERS -------------------------------------------------------------------
-- Single users table for both employees and admins. Role determines portal.
create table if not exists public.users (
  user_id      bigserial primary key,
  name         text not null,
  email        text unique not null,
  role         text not null check (role in ('admin', 'employee')),
  created_at   timestamptz not null default now()
);

-- 2. MESSAGES ----------------------------------------------------------------
-- One row per chat message. Each conversation is keyed by employee_id.
-- sender_type: who sent it. 'system' is for resolution markers.
-- (You may want to add 'ai' as a valid sender_type when implementing AI replies.)
create table if not exists public.messages (
  message_id     bigserial primary key,
  employee_id    bigint not null references public.users(user_id) on delete cascade,
  message        text not null,
  sender_type    text not null check (sender_type in ('employee', 'admin', 'system')),
  admin_user_id  bigint references public.users(user_id) on delete set null,
  is_read        boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_messages_employee_id on public.messages(employee_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- 3. RLS ---------------------------------------------------------------------
-- This test project uses the anon key for everything; we keep RLS enabled
-- with permissive policies so Supabase doesn't warn about RLS-off tables.
alter table public.users enable row level security;
alter table public.messages enable row level security;

drop policy if exists "anon_all_users" on public.users;
create policy "anon_all_users" on public.users for all using (true) with check (true);

drop policy if exists "anon_all_messages" on public.messages;
create policy "anon_all_messages" on public.messages for all using (true) with check (true);

-- 4. REALTIME ----------------------------------------------------------------
-- Enable realtime so messages stream to connected clients without polling.
alter publication supabase_realtime add table public.messages;

-- 5. SEED DATA ---------------------------------------------------------------
-- One admin and two employees so candidates can simulate a multi-user chat.
insert into public.users (name, email, role) values
  ('Sarah Chen',       'sarah@example.com',   'admin'),
  ('Juan Dela Cruz',   'juan@example.com',    'employee'),
  ('Maria Santos',     'maria@example.com',   'employee')
on conflict (email) do nothing;

-- Sample opening messages so the inbox isn't empty on first load.
insert into public.messages (employee_id, message, sender_type)
select u.user_id, 'Hi, I have a question about my last payslip.', 'employee'
from public.users u where u.email = 'juan@example.com'
and not exists (select 1 from public.messages m where m.employee_id = u.user_id);

insert into public.messages (employee_id, message, sender_type)
select u.user_id, 'When is the next payout date?', 'employee'
from public.users u where u.email = 'maria@example.com'
and not exists (select 1 from public.messages m where m.employee_id = u.user_id);
