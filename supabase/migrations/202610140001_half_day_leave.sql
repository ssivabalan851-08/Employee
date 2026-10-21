begin;

-- Leave balances and request durations must preserve half-day increments through
-- submission, approval, withdrawal and cancellation.
alter table public.leave_balances
  alter column annual_total type numeric(6,2) using annual_total::numeric,
  alter column annual_used type numeric(6,2) using annual_used::numeric,
  alter column sick_total type numeric(6,2) using sick_total::numeric,
  alter column sick_used type numeric(6,2) using sick_used::numeric,
  alter column casual_total type numeric(6,2) using casual_total::numeric,
  alter column casual_used type numeric(6,2) using casual_used::numeric,
  alter column parental_total type numeric(6,2) using parental_total::numeric,
  alter column parental_used type numeric(6,2) using parental_used::numeric;

alter table public.leave_requests
  alter column total_days type numeric(6,2) using total_days::numeric,
  add column day_portion text not null default 'full_day';

alter table public.leave_policy_evaluations
  alter column business_days type numeric(6,2) using business_days::numeric,
  add column day_portion text not null default 'full_day';

alter table public.leave_coverage_snapshots
  alter column business_days type numeric(6,2) using business_days::numeric,
  add column day_portion text not null default 'full_day';

alter table public.leave_requests
  add constraint leave_requests_day_portion_check
    check (day_portion in ('full_day', 'morning', 'afternoon')),
  add constraint leave_requests_half_day_single_date_check
    check (day_portion = 'full_day' or start_date = end_date),
  add constraint leave_requests_half_day_increment_check
    check (mod(total_days * 2, 1) = 0);

alter table public.leave_policy_evaluations
  add constraint leave_policy_evaluations_day_portion_check
    check (day_portion in ('full_day', 'morning', 'afternoon')),
  add constraint leave_policy_evaluations_half_day_single_date_check
    check (day_portion = 'full_day' or start_date = end_date);

alter table public.leave_coverage_snapshots
  add constraint leave_coverage_snapshots_day_portion_check
    check (day_portion in ('full_day', 'morning', 'afternoon')),
  add constraint leave_coverage_snapshots_half_day_single_date_check
    check (day_portion = 'full_day' or start_date = end_date);

alter table public.leave_balances
  add constraint leave_balances_half_day_increment_check check (
    mod(annual_total * 2, 1) = 0 and mod(annual_used * 2, 1) = 0
    and mod(sick_total * 2, 1) = 0 and mod(sick_used * 2, 1) = 0
    and mod(casual_total * 2, 1) = 0 and mod(casual_used * 2, 1) = 0
    and mod(parental_total * 2, 1) = 0 and mod(parental_used * 2, 1) = 0
  );

create or replace function private.requested_leave_days(
  p_start_date date,
  p_end_date date,
  p_day_portion text
)
returns numeric
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_portion text := lower(btrim(coalesce(p_day_portion, 'full_day')));
  v_business_days integer;
begin
  if v_portion not in ('full_day', 'morning', 'afternoon') then
    raise exception 'Invalid leave duration';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'End date must be on or after start date';
  end if;
  if v_portion <> 'full_day' and p_start_date <> p_end_date then
    raise exception 'Half-day leave must start and end on the same date';
  end if;

  v_business_days := private.business_days_between(p_start_date, p_end_date);
  if v_portion <> 'full_day' then
    return case when v_business_days = 1 then 0.5 else 0 end;
  end if;
  return v_business_days;
end;
$$;

create or replace function private.apply_authoritative_business_days()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  new.day_portion := lower(btrim(coalesce(new.day_portion, 'full_day')));
  new.total_days := private.requested_leave_days(new.start_date, new.end_date, new.day_portion);
  if new.total_days < 0.5 then
    raise exception 'Leave dates must include a working day';
  end if;
  return new;
end;
$$;

drop trigger if exists apply_authoritative_business_days on public.leave_requests;
create trigger apply_authoritative_business_days
before insert or update of start_date, end_date, day_portion on public.leave_requests
for each row execute function private.apply_authoritative_business_days();

-- Existing full-day entry points also use decimal balance comparisons so a
-- remaining balance such as 1.5 cannot be rounded during policy or approval checks.
-- Rebuilding from the installed definitions keeps this migration compatible with
-- the exact functions already present in the project.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  foreach v_definition in array array[
    pg_get_functiondef('public.submit_leave_request(text,date,date,text)'::regprocedure),
    pg_get_functiondef('private.create_policy_evaluation(uuid,text,date,date,text)'::regprocedure),
    pg_get_functiondef('public.submit_leave_request_v2(text,date,date,text,uuid,jsonb)'::regprocedure),
    pg_get_functiondef('public.process_leave_request_v2(uuid,text,text,text)'::regprocedure)
  ] loop
    v_updated := replace(v_definition, 'v_remaining integer;', 'v_remaining numeric;');
    v_updated := replace(v_updated, 'remaining integer;', 'remaining numeric;');
    if v_updated = v_definition then
      raise exception 'Expected integer balance declaration was not found in an installed leave function';
    end if;
    execute v_updated;
  end loop;
end;
$migration$;
-- Numeric balance input keeps HR adjustments consistent with half-day usage.
create or replace function public.update_employee_balance(p_user_id uuid, p_balances jsonb) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_manager() then raise exception 'Manager access required'; end if;
  update public.leave_balances set
    annual_total=coalesce((p_balances#>>'{annual,total}')::numeric,annual_total), annual_used=coalesce((p_balances#>>'{annual,used}')::numeric,annual_used),
    sick_total=coalesce((p_balances#>>'{sick,total}')::numeric,sick_total), sick_used=coalesce((p_balances#>>'{sick,used}')::numeric,sick_used),
    casual_total=coalesce((p_balances#>>'{casual,total}')::numeric,casual_total), casual_used=coalesce((p_balances#>>'{casual,used}')::numeric,casual_used),
    parental_total=coalesce((p_balances#>>'{parental,total}')::numeric,parental_total), parental_used=coalesce((p_balances#>>'{parental,used}')::numeric,parental_used), updated_at=now()
  where user_id=p_user_id;
  insert into public.notifications(user_id,title,message) values(p_user_id,'Leave balances updated','HR updated your leave balances.');
end $$;

-- Five-argument preview adds half-day semantics while preserving the existing
-- four-argument full-day RPC for older clients.
create or replace function public.preview_leave_request(
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_day_portion text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_portion text := lower(btrim(coalesce(p_day_portion, 'full_day')));
  v_requested_days numeric;
  v_preview jsonb;
  v_evaluation_id uuid;
  v_snapshot_id uuid;
  v_remaining numeric;
  v_checks jsonb;
  v_status text;
begin
  v_requested_days := private.requested_leave_days(p_start_date, p_end_date, v_portion);
  if v_requested_days < 0.5 then
    raise exception 'Leave dates must include a working day';
  end if;

  v_preview := public.preview_leave_request(p_leave_type, p_start_date, p_end_date, p_reason);
  v_evaluation_id := (v_preview ->> 'policyEvaluationId')::uuid;
  v_snapshot_id := (v_preview ->> 'coverageSnapshotId')::uuid;

  if v_portion = 'full_day' then
    update public.leave_policy_evaluations set day_portion = v_portion where id = v_evaluation_id;
    update public.leave_coverage_snapshots set day_portion = v_portion where id = v_snapshot_id;
    return v_preview || jsonb_build_object('dayPortion', v_portion, 'workingDays', v_requested_days);
  end if;

  select case p_leave_type
    when 'annual' then balance.annual_total - balance.annual_used
    when 'sick' then balance.sick_total - balance.sick_used
    when 'casual' then balance.casual_total - balance.casual_used
    when 'parental' then balance.parental_total - balance.parental_used
  end into v_remaining
  from public.leave_balances balance
  where balance.user_id = auth.uid();
  v_remaining := greatest(coalesce(v_remaining, 0), 0);

  select coalesce(jsonb_agg(
    case item.value ->> 'code'
      when 'business_days' then item.value || jsonb_build_object(
        'status', 'pass', 'actual', v_requested_days,
        'message', format('%s working day requested (%s half day).', v_requested_days, v_portion)
      )
      when 'maximum_duration' then item.value || jsonb_build_object(
        'status', 'pass', 'actual', v_requested_days,
        'message', format('%s day requested within the permitted duration.', v_requested_days)
      )
      when 'leave_balance' then item.value || jsonb_build_object(
        'status', case when v_requested_days <= v_remaining then 'pass' else 'fail' end,
        'requested', v_requested_days, 'available', v_remaining,
        'message', format('%s day requested with %s day(s) available.', v_requested_days, v_remaining)
      )
      else item.value
    end order by item.position
  ), '[]'::jsonb)
  into v_checks
  from public.leave_policy_evaluations evaluation,
       jsonb_array_elements(evaluation.checks) with ordinality as item(value, position)
  where evaluation.id = v_evaluation_id;

  select case
    when exists (select 1 from jsonb_array_elements(v_checks) check_item where check_item ->> 'status' = 'fail') then 'fail'
    when exists (select 1 from jsonb_array_elements(v_checks) check_item where check_item ->> 'status' = 'warning') then 'warning'
    else 'pass'
  end into v_status;

  update public.leave_policy_evaluations
  set business_days = v_requested_days,
      day_portion = v_portion,
      checks = v_checks,
      overall_status = v_status
  where id = v_evaluation_id;

  update public.leave_coverage_snapshots
  set business_days = v_requested_days,
      day_portion = v_portion
  where id = v_snapshot_id;

  v_preview := jsonb_set(v_preview, '{policy,businessDays}', to_jsonb(v_requested_days), true);
  v_preview := jsonb_set(v_preview, '{policy,status}', to_jsonb(v_status), true);
  v_preview := jsonb_set(v_preview, '{policy,checks}', v_checks, true);
  return v_preview || jsonb_build_object(
    'dayPortion', v_portion,
    'workingDays', v_requested_days
  );
end;
$$;

-- The new overload verifies that the submitted portion matches the preview,
-- then stores the authoritative 0.5-day duration atomically.
create or replace function public.submit_leave_request_v2(
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_day_portion text,
  p_coverage_snapshot_id uuid default null,
  p_handover jsonb default null
)
returns setof public.leave_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_portion text := lower(btrim(coalesce(p_day_portion, 'full_day')));
  v_snapshot_id uuid := p_coverage_snapshot_id;
  v_preview jsonb;
  v_snapshot public.leave_coverage_snapshots;
  v_request public.leave_requests;
begin
  perform private.requested_leave_days(p_start_date, p_end_date, v_portion);
  if v_snapshot_id is null then
    v_preview := public.preview_leave_request(p_leave_type, p_start_date, p_end_date, p_reason, v_portion);
    v_snapshot_id := (v_preview ->> 'coverageSnapshotId')::uuid;
  end if;

  select snapshot.* into v_snapshot
  from public.leave_coverage_snapshots snapshot
  where snapshot.id = v_snapshot_id and snapshot.user_id = auth.uid();
  if not found or v_snapshot.day_portion <> v_portion then
    raise exception 'The submitted leave duration does not match its preview';
  end if;

  select submitted.* into v_request
  from public.submit_leave_request_v2(
    p_leave_type,
    p_start_date,
    p_end_date,
    p_reason,
    v_snapshot_id,
    p_handover
  ) submitted;

  update public.leave_requests
  set day_portion = v_portion
  where id = v_request.id
  returning * into v_request;

  return next v_request;
end;
$$;

create or replace function public.submit_leave_request(
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_day_portion text
)
returns setof public.leave_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_preview jsonb;
begin
  v_preview := public.preview_leave_request(p_leave_type, p_start_date, p_end_date, p_reason, p_day_portion);
  return query select * from public.submit_leave_request_v2(
    p_leave_type,
    p_start_date,
    p_end_date,
    p_reason,
    p_day_portion,
    (v_preview ->> 'coverageSnapshotId')::uuid,
    null
  );
end;
$$;

revoke all on function private.requested_leave_days(date, date, text) from public, anon, authenticated;
revoke all on function public.preview_leave_request(text, date, date, text, text) from public, anon, authenticated;
revoke all on function public.submit_leave_request_v2(text, date, date, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.submit_leave_request(text, date, date, text, text) from public, anon, authenticated;
grant execute on function public.preview_leave_request(text, date, date, text, text) to authenticated;
grant execute on function public.submit_leave_request_v2(text, date, date, text, text, uuid, jsonb) to authenticated;
grant execute on function public.submit_leave_request(text, date, date, text, text) to authenticated;

comment on column public.leave_requests.day_portion is
  'Full-day, morning half-day or afternoon half-day selection used to calculate the authoritative leave deduction.';
comment on function private.requested_leave_days(date, date, text) is
  'Returns the authoritative balance deduction, including 0.5 for a valid half-day request.';

commit;
