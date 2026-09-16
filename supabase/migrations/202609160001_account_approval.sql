alter table public.profiles
  add column if not exists requested_role public.user_role not null default 'employee',
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id);

-- Accounts that existed before this workflow remain usable.
update public.profiles
set approval_status = 'approved',
    requested_role = role,
    approved_at = coalesce(approved_at, now())
where approval_status = 'pending';

create table if not exists public.account_approval_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  approval_token_hash text unique,
  email_sent_at timestamptz,
  decided_at timestamptz,
  decision text check (decision in ('approved', 'rejected')),
  decision_email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.account_approval_requests enable row level security;
revoke all on public.account_approval_requests from anon, authenticated;

create or replace function public.is_manager(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = check_user and role = 'manager' and approval_status = 'approved'
  )
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  requested public.user_role;
begin
  requested := case
    when new.raw_user_meta_data->>'requested_role' = 'manager' then 'manager'::public.user_role
    else 'employee'::public.user_role
  end;

  insert into public.profiles(id, email, name, role, requested_role, approval_status, department, title)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Employee'), '@', 1)),
    'employee',
    requested,
    'pending',
    coalesce(new.raw_user_meta_data->>'department', case when requested = 'manager' then 'Human Resources' else 'Engineering' end),
    coalesce(new.raw_user_meta_data->>'title', case when requested = 'manager' then 'HR Manager' else 'Team Member' end)
  )
  on conflict (id) do nothing;

  insert into public.leave_balances(user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.account_approval_requests(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (
    old.role <> new.role or
    old.requested_role <> new.requested_role or
    old.approval_status <> new.approval_status or
    old.approved_at is distinct from new.approved_at or
    old.approved_by is distinct from new.approved_by
  ) and auth.role() <> 'service_role' and not public.is_manager(auth.uid()) then
    raise exception 'Only an authorized administrator can change account access';
  end if;
  new.updated_at = now();
  return new;
end $$;

create or replace function public.enforce_approved_leave_request() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.user_id and approval_status = 'approved'
  ) then
    raise exception 'Administrator approval is required before leave requests can be submitted';
  end if;
  return new;
end $$;

drop trigger if exists enforce_approved_leave_request on public.leave_requests;
create trigger enforce_approved_leave_request
before insert on public.leave_requests
for each row execute function public.enforce_approved_leave_request();

comment on table public.account_approval_requests is
  'Private one-time token hashes used by the account approval Edge Function. Browser clients have no access.';
