-- ============================================================================
-- Chat Support — Interview Test Schema (production-mirrored)
-- ============================================================================
-- Paste this entire file into the Supabase SQL Editor and run it once.
-- Project: https://supabase.com/dashboard/project/_/sql/new
--
-- This mirrors the relevant slice of the production schema closely enough that
-- the pages copied verbatim from the real app keep working. Passwords are
-- plain-text on purpose — sandbox only.
-- ============================================================================

-- 1. CORE TABLES -------------------------------------------------------------

create table if not exists public.xin_user_roles (
  role_id        bigserial primary key,
  role_name      text not null,
  role_resources text default ''
);

insert into public.xin_user_roles (role_id, role_name, role_resources) values
  (1, 'Super Admin', ''),
  (2, 'Employee',    ''),
  (6, 'Recruitment Officer', '')
on conflict (role_id) do nothing;

create table if not exists public.xin_companies (
  company_id bigserial primary key,
  name text not null
);

create table if not exists public.xin_designations (
  designation_id   bigserial primary key,
  designation_name text not null
);

create table if not exists public.xin_employees (
  user_id            bigserial primary key,
  employee_id        text unique,
  first_name         text not null,
  last_name          text not null,
  middle_name        text,
  email              text unique,
  username           text unique,
  sss_no             text,
  password           text not null,
  password_unhashed  text,
  user_role_id       bigint references public.xin_user_roles(role_id),
  role_id            bigint,
  company_id         bigint,
  designation_id     bigint,
  is_active          int  not null default 1,
  is_logged_in       int  default 0,
  last_logout_date   timestamptz,
  contact_no         text,
  date_of_birth      text,
  date_of_joining    text,
  date_of_leaving    text,
  gender             text,
  marital_status     text,
  birth_place        text,
  philhealth_no      text,
  pagibig_no         text,
  tin_no             text,
  biometric_id       text,
  sub_location       text,
  nbi_exp            text,
  healthcard_exp     text,
  e_status           int default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_xin_employees_username on public.xin_employees(username);
create index if not exists idx_xin_employees_sss_no   on public.xin_employees(sss_no);

create table if not exists public.xin_officer_companies (
  user_id    bigint not null,
  company_id bigint not null,
  primary key (user_id, company_id)
);

-- 2. CHAT TABLES -------------------------------------------------------------

create table if not exists public.xin_employee_messages (
  message_id      bigserial primary key,
  employee_id     bigint not null,
  message         text not null,
  sender_type     text not null check (sender_type in ('employee', 'admin', 'system')),
  admin_user_id   bigint,
  is_read         boolean not null default false,
  attachment_url  text,
  attachment_name text,
  attachment_type text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_emp_messages_employee_id on public.xin_employee_messages(employee_id);

-- Per-admin read tracking — multiple admins each have independent read state.
create table if not exists public.xin_admin_message_reads (
  read_id       bigserial primary key,
  admin_user_id bigint not null,
  message_type  text   not null check (message_type in ('employee', 'applicant')),
  message_id    bigint not null,
  created_at    timestamptz not null default now(),
  unique (admin_user_id, message_type, message_id)
);

create table if not exists public.xin_chat_feedback (
  feedback_id    bigserial primary key,
  chat_type      text not null check (chat_type in ('employee', 'applicant')),
  employee_id    bigint,
  application_id bigint,
  admin_user_id  bigint,
  rating         int not null check (rating between 1 and 5),
  comment        text,
  resolved       text check (resolved in ('yes', 'no', 'n/a')),
  created_at     timestamptz not null default now()
);

-- 3. ROW-LEVEL SECURITY ------------------------------------------------------
-- Permissive policies on every table — the sandbox uses the anon key only.
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'xin_user_roles','xin_companies','xin_designations','xin_employees',
      'xin_officer_companies','xin_employee_messages','xin_admin_message_reads',
      'xin_chat_feedback'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "anon_all" on public.%I', t);
    execute format('create policy "anon_all" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;

-- 4. REALTIME ----------------------------------------------------------------
alter publication supabase_realtime add table public.xin_employee_messages;
alter publication supabase_realtime add table public.xin_admin_message_reads;
alter publication supabase_realtime add table public.xin_chat_feedback;

-- 5. STORAGE BUCKET (chat attachments) ---------------------------------------
-- Public bucket for image/PDF/Excel uploads in the chat. Permissive policies
-- so the anon client can read/write without sign-in.

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

drop policy if exists "anon_chat_attachments_select" on storage.objects;
drop policy if exists "anon_chat_attachments_insert" on storage.objects;
drop policy if exists "anon_chat_attachments_update" on storage.objects;
drop policy if exists "anon_chat_attachments_delete" on storage.objects;

create policy "anon_chat_attachments_select" on storage.objects
  for select using (bucket_id = 'chat-attachments');
create policy "anon_chat_attachments_insert" on storage.objects
  for insert with check (bucket_id = 'chat-attachments');
create policy "anon_chat_attachments_update" on storage.objects
  for update using (bucket_id = 'chat-attachments') with check (bucket_id = 'chat-attachments');
create policy "anon_chat_attachments_delete" on storage.objects
  for delete using (bucket_id = 'chat-attachments');

-- 6. RPCs --------------------------------------------------------------------
-- Plain-password versions of the production login RPCs. Production uses
-- bcrypt; this sandbox just compares strings. Same response shape so the
-- frontend code works without modification.

create or replace function public.verify_login(p_username text, p_password text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp record;
begin
  select e.user_id, e.employee_id, e.username, e.email, e.first_name, e.last_name,
         e.role_id, e.user_role_id, e.company_id, e.designation_id, e.is_active,
         e.password
    into v_emp
  from xin_employees e
  where (e.username = p_username or e.sss_no = p_username) and e.is_active = 1
  limit 1;

  if not found then
    return json_build_object('error', 'Invalid username or password');
  end if;

  if v_emp.password is distinct from p_password then
    return json_build_object('error', 'Invalid username or password');
  end if;

  return json_build_object(
    'success', true,
    'user', json_build_object(
      'user_id', v_emp.user_id,
      'employee_id', v_emp.employee_id,
      'username', v_emp.username,
      'email', v_emp.email,
      'first_name', v_emp.first_name,
      'last_name', v_emp.last_name,
      'role', '',
      'role_id', coalesce(v_emp.role_id, v_emp.user_role_id, 1),
      'company_id', v_emp.company_id,
      'designation_id', v_emp.designation_id
    )
  );
end;
$$;

create or replace function public.verify_employee_login(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public as $$
begin
  return public.verify_login(p_username, p_password);
end;
$$;

-- 7. SEED DATA ---------------------------------------------------------------
-- Test creds:
--   Admin    →  username: admin       password: admin123
--   Juan     →  sss_no:   01-1234567-8 password: employee123
--   Maria    →  sss_no:   02-2345678-9 password: employee123

insert into public.xin_employees (
  employee_id, first_name, last_name, email, username, sss_no, password,
  user_role_id, role_id, is_active
) values
  ('ADM001', 'Sarah', 'Chen',     'sarah@example.com', 'admin', null,           'admin123',    1, 1, 1),
  ('EMP001', 'Juan',  'Dela Cruz','juan@example.com',   null,    '01-1234567-8','employee123', 2, 2, 1),
  ('EMP002', 'Maria', 'Santos',   'maria@example.com',  null,    '02-2345678-9','employee123', 2, 2, 1)
on conflict (employee_id) do nothing;

insert into public.xin_employee_messages (employee_id, message, sender_type)
select e.user_id, 'Hi, I have a question about my last payslip.', 'employee'
from public.xin_employees e where e.employee_id = 'EMP001'
and not exists (select 1 from public.xin_employee_messages m where m.employee_id = e.user_id);

insert into public.xin_employee_messages (employee_id, message, sender_type)
select e.user_id, 'When is the next payout date?', 'employee'
from public.xin_employees e where e.employee_id = 'EMP002'
and not exists (select 1 from public.xin_employee_messages m where m.employee_id = e.user_id);
