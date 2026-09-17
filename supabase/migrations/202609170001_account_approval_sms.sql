begin;

alter table public.profiles
  add column if not exists phone_number text;

alter table public.profiles
  drop constraint if exists profiles_phone_number_e164;
alter table public.profiles
  add constraint profiles_phone_number_e164
  check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{7,14}$');

alter table public.account_approval_requests
  add column if not exists approval_sms_attempted_at timestamptz,
  add column if not exists approval_sms_sent_at timestamptz,
  add column if not exists approval_sms_message_id text,
  add column if not exists approval_sms_error text;

-- Repair pending accounts created while the notification function lacked table access.
insert into public.account_approval_requests(user_id)
select id from public.profiles where approval_status = 'pending'
on conflict (user_id) do nothing;

-- Browser clients must never read approval tokens. The Edge Function uses only
-- the service role and receives the minimum table privileges it needs.
alter table public.account_approval_requests enable row level security;
revoke all on public.account_approval_requests from anon, authenticated;
grant usage on schema public to service_role;
grant select, update on public.profiles to service_role;
grant select, insert, update on public.account_approval_requests to service_role;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  requested public.user_role;
  applicant_phone text;
begin
  requested := case
    when new.raw_user_meta_data->>'requested_role' = 'manager' then 'manager'::public.user_role
    else 'employee'::public.user_role
  end;
  applicant_phone := nullif(new.raw_user_meta_data->>'phone_number', '');

  insert into public.profiles(id, email, name, role, requested_role, approval_status, department, title, phone_number)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Employee'), '@', 1)),
    'employee',
    requested,
    'pending',
    coalesce(new.raw_user_meta_data->>'department', case when requested = 'manager' then 'Human Resources' else 'Engineering' end),
    coalesce(new.raw_user_meta_data->>'title', case when requested = 'manager' then 'HR Manager' else 'Team Member' end),
    applicant_phone
  )
  on conflict (id) do nothing;

  insert into public.leave_balances(user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.account_approval_requests(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

comment on column public.profiles.phone_number is
  'Applicant mobile number stored in E.164 format for the one-time account approval SMS.';

commit;
