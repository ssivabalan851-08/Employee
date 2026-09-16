create extension if not exists pgcrypto;

create type public.user_role as enum ('employee', 'manager');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancellation_pending', 'cancelled', 'withdrawn');
create type public.notification_status as enum ('unread', 'read');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role public.user_role not null default 'employee',
  department text not null default 'Engineering',
  title text not null default 'Team Member',
  joined_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leave_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  annual_total integer not null default 20 check (annual_total >= 0),
  annual_used integer not null default 0 check (annual_used >= 0),
  sick_total integer not null default 10 check (sick_total >= 0),
  sick_used integer not null default 0 check (sick_used >= 0),
  casual_total integer not null default 7 check (casual_total >= 0),
  casual_used integer not null default 0 check (casual_used >= 0),
  parental_total integer not null default 30 check (parental_total >= 0),
  parental_used integer not null default 0 check (parental_used >= 0),
  updated_at timestamptz not null default now()
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  employee_name text not null,
  employee_email text not null,
  department text not null,
  leave_type text not null check (leave_type in ('annual', 'sick', 'casual', 'parental')),
  start_date date not null,
  end_date date not null,
  total_days integer not null check (total_days > 0),
  reason text not null,
  status public.leave_status not null default 'pending',
  cancellation_requested_at timestamptz,
  cancellation_reason text,
  cancelled_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  manager_comment text,
  processed_at timestamptz,
  processed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  status public.notification_status not null default 'unread',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  leave_id uuid not null references public.leave_requests(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  actor_name text not null,
  actor_role text not null check (actor_role in ('employee', 'hr')),
  action text not null check (action in ('leave_submitted', 'leave_approved', 'leave_rejected', 'leave_cancellation_requested', 'leave_cancelled')),
  previous_status text,
  new_status text,
  reason text,
  created_at timestamptz not null default now()
);

create index leave_requests_user_created_idx on public.leave_requests(user_id, created_at desc);
create index leave_requests_status_created_idx on public.leave_requests(status, created_at desc);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index audit_logs_employee_created_idx on public.audit_logs(employee_id, created_at desc);

create or replace function public.is_manager(check_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = check_user and role = 'manager') $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, email, name, department, title)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'Employee'), '@', 1)), coalesce(new.raw_user_meta_data->>'department', 'Engineering'), coalesce(new.raw_user_meta_data->>'title', 'Team Member'))
  on conflict (id) do nothing;
  insert into public.leave_balances(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.role <> new.role and not public.is_manager(auth.uid()) then raise exception 'Only a manager can change account roles'; end if;
  new.updated_at = now();
  return new;
end $$;
create trigger protect_profile_role before update on public.profiles for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_manager());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid() and role = 'employee');
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_manager()) with check (id = auth.uid() or public.is_manager());
create policy balances_select on public.leave_balances for select to authenticated using (user_id = auth.uid() or public.is_manager());
create policy balances_insert on public.leave_balances for insert to authenticated with check (user_id = auth.uid());
create policy requests_select on public.leave_requests for select to authenticated using (user_id = auth.uid() or public.is_manager());
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_select on public.audit_logs for select to authenticated using (employee_id = auth.uid() or public.is_manager());

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.leave_balances to authenticated;
grant select on public.leave_requests to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;

create or replace function public.submit_leave_request(p_leave_type text, p_start_date date, p_end_date date, p_reason text) returns setof public.leave_requests
language plpgsql security definer set search_path = public
as $$
declare p public.profiles; r public.leave_requests; total integer; remaining integer;
begin
  if p_leave_type not in ('annual','sick','casual','parental') then raise exception 'Invalid leave type'; end if;
  if p_end_date < p_start_date then raise exception 'End date must be on or after start date'; end if;
  if trim(coalesce(p_reason,''))='' then raise exception 'A reason is required'; end if;
  select count(*)::int into total from generate_series(p_start_date,p_end_date,interval '1 day') d where extract(isodow from d) < 6;
  if total < 1 then raise exception 'Leave dates must include at least one working day'; end if;
  select * into p from public.profiles where id=auth.uid();
  if not found then raise exception 'Employee profile not found'; end if;
  insert into public.leave_requests(user_id,employee_name,employee_email,department,leave_type,start_date,end_date,total_days,reason)
  values(auth.uid(),p.name,p.email,p.department,p_leave_type,p_start_date,p_end_date,total,p_reason) returning * into r;
  execute format('select %I-%I from public.leave_balances where user_id=$1',p_leave_type||'_total',p_leave_type||'_used') into remaining using auth.uid();
  if total > coalesce(remaining,0) then insert into public.notifications(user_id,title,message) values(auth.uid(),'Insufficient leave balance',format('This %s-day request exceeds your remaining %s balance of %s days.',total,p_leave_type,coalesce(remaining,0))); end if;
  insert into public.audit_logs(leave_id,employee_id,actor_id,actor_name,actor_role,action,previous_status,new_status,reason) values(r.id,auth.uid(),auth.uid(),p.name,'employee','leave_submitted','none','pending',p_reason);
  return next r;
end $$;

create or replace function public.process_leave_request(p_request_id uuid, p_action text, p_comment text default '') returns void
language plpgsql security definer set search_path = public
as $$
declare r public.leave_requests; manager_name text; next_status public.leave_status; used_col text;
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  if p_action not in ('approve','reject') then raise exception 'Unsupported action'; end if;
  select * into r from public.leave_requests where id = p_request_id for update;
  if not found then raise exception 'Leave request not found'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be processed'; end if;
  select name into manager_name from public.profiles where id = auth.uid();
  next_status := case when p_action = 'approve' then 'approved'::public.leave_status else 'rejected'::public.leave_status end;
  if p_action = 'approve' then
    used_col := quote_ident(r.leave_type || '_used');
    execute format('update public.leave_balances set %s = %s + $1, updated_at = now() where user_id = $2', used_col, used_col) using r.total_days, r.user_id;
  end if;
  update public.leave_requests set status = next_status, manager_comment = p_comment, processed_at = now(), processed_by = auth.uid(), updated_at = now(), approved_at = case when p_action='approve' then now() else approved_at end, rejected_at = case when p_action='reject' then now() else rejected_at end where id = p_request_id;
  insert into public.notifications(user_id,title,message) values (r.user_id, case when p_action='approve' then 'Leave approved' else 'Leave request declined' end, format('Your %s leave from %s to %s was %s.%s', r.leave_type, r.start_date, r.end_date, case when p_action='approve' then 'approved' else 'declined' end, case when coalesce(p_comment,'')='' then '' else ' Comment: '||p_comment end));
  insert into public.audit_logs(leave_id,employee_id,actor_id,actor_name,actor_role,action,previous_status,new_status,reason) values (r.id,r.user_id,auth.uid(),coalesce(manager_name,'HR Manager'),'hr',case when p_action='approve' then 'leave_approved' else 'leave_rejected' end,'pending',next_status::text,p_comment);
end $$;

create or replace function public.withdraw_leave_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
declare r public.leave_requests; actor_name text; used_col text;
begin
  select * into r from public.leave_requests where id=p_request_id and user_id=auth.uid() for update;
  if not found then raise exception 'Leave request not found'; end if;
  if r.status not in ('pending','approved') then raise exception 'This request cannot be withdrawn'; end if;
  if r.status='approved' then used_col := quote_ident(r.leave_type||'_used'); execute format('update public.leave_balances set %s=greatest(0,%s-$1), updated_at=now() where user_id=$2',used_col,used_col) using r.total_days,r.user_id; end if;
  update public.leave_requests set status='withdrawn',processed_at=now(),updated_at=now() where id=r.id;
  select name into actor_name from public.profiles where id=auth.uid();
  insert into public.notifications(user_id,title,message) values(r.user_id,'Leave withdrawn',format('Your %s leave from %s to %s was withdrawn.',r.leave_type,r.start_date,r.end_date));
  insert into public.audit_logs(leave_id,employee_id,actor_id,actor_name,actor_role,action,previous_status,new_status,reason) values(r.id,r.user_id,auth.uid(),actor_name,'employee','leave_cancelled',r.status::text,'withdrawn','Withdrawn by employee');
end $$;

create or replace function public.request_leave_cancellation(p_request_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
declare r public.leave_requests; actor_name text; next_status public.leave_status;
begin
  if trim(coalesce(p_reason,''))='' then raise exception 'Cancellation reason is required'; end if;
  select * into r from public.leave_requests where id=p_request_id and user_id=auth.uid() for update;
  if not found then raise exception 'Leave request not found'; end if;
  if r.start_date <= current_date then raise exception 'Leave that has started cannot be cancelled'; end if;
  if r.status not in ('pending','approved') then raise exception 'This request cannot be cancelled'; end if;
  next_status := case when r.status='pending' then 'cancelled'::public.leave_status else 'cancellation_pending'::public.leave_status end;
  update public.leave_requests set status=next_status,cancellation_reason=p_reason,cancellation_requested_at=now(),cancelled_at=case when r.status='pending' then now() else null end,updated_at=now() where id=r.id;
  select name into actor_name from public.profiles where id=auth.uid();
  insert into public.audit_logs(leave_id,employee_id,actor_id,actor_name,actor_role,action,previous_status,new_status,reason) values(r.id,r.user_id,auth.uid(),actor_name,'employee',case when r.status='pending' then 'leave_cancelled' else 'leave_cancellation_requested' end,r.status::text,next_status::text,p_reason);
end $$;

create or replace function public.process_leave_cancellation(p_request_id uuid, p_approve boolean, p_comment text default '') returns void
language plpgsql security definer set search_path = public
as $$
declare r public.leave_requests; manager_name text; next_status public.leave_status; used_col text;
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  select * into r from public.leave_requests where id=p_request_id for update;
  if not found or r.status <> 'cancellation_pending' then raise exception 'Cancellation request not found'; end if;
  next_status := case when p_approve then 'cancelled'::public.leave_status else 'approved'::public.leave_status end;
  if p_approve then used_col := quote_ident(r.leave_type||'_used'); execute format('update public.leave_balances set %s=greatest(0,%s-$1), updated_at=now() where user_id=$2',used_col,used_col) using r.total_days,r.user_id; end if;
  update public.leave_requests set status=next_status,manager_comment=p_comment,processed_at=now(),processed_by=auth.uid(),cancelled_at=case when p_approve then now() else null end,updated_at=now() where id=r.id;
  select name into manager_name from public.profiles where id=auth.uid();
  insert into public.notifications(user_id,title,message) values(r.user_id,case when p_approve then 'Leave cancellation approved' else 'Leave cancellation declined' end,case when p_approve then 'HR approved your leave cancellation.' else 'HR declined your cancellation. The leave remains approved. '||coalesce(p_comment,'') end);
  insert into public.audit_logs(leave_id,employee_id,actor_id,actor_name,actor_role,action,previous_status,new_status,reason) values(r.id,r.user_id,auth.uid(),manager_name,'hr',case when p_approve then 'leave_cancelled' else 'leave_approved' end,'cancellation_pending',next_status::text,p_comment);
end $$;

create or replace function public.update_employee_balance(p_user_id uuid, p_balances jsonb) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  update public.leave_balances set
    annual_total=coalesce((p_balances#>>'{annual,total}')::int,annual_total), annual_used=coalesce((p_balances#>>'{annual,used}')::int,annual_used),
    sick_total=coalesce((p_balances#>>'{sick,total}')::int,sick_total), sick_used=coalesce((p_balances#>>'{sick,used}')::int,sick_used),
    casual_total=coalesce((p_balances#>>'{casual,total}')::int,casual_total), casual_used=coalesce((p_balances#>>'{casual,used}')::int,casual_used),
    parental_total=coalesce((p_balances#>>'{parental,total}')::int,parental_total), parental_used=coalesce((p_balances#>>'{parental,used}')::int,parental_used), updated_at=now()
  where user_id=p_user_id;
  insert into public.notifications(user_id,title,message) values(p_user_id,'Leave balances updated','HR updated your leave balances.');
end $$;

grant execute on function public.process_leave_request(uuid,text,text) to authenticated;
grant execute on function public.submit_leave_request(text,date,date,text) to authenticated;
grant execute on function public.withdraw_leave_request(uuid) to authenticated;
grant execute on function public.request_leave_cancellation(uuid,text) to authenticated;
grant execute on function public.process_leave_cancellation(uuid,boolean,text) to authenticated;
grant execute on function public.update_employee_balance(uuid,jsonb) to authenticated;

revoke all on all tables in schema public from anon;
