create table if not exists public.company_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  event_type text not null check (event_type in ('government', 'company')),
  note text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_date, title)
);

create index if not exists company_calendar_events_active_date_idx
  on public.company_calendar_events (event_date)
  where is_active = true;

create or replace function public.set_company_calendar_event_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists set_company_calendar_event_updated_at on public.company_calendar_events;
create trigger set_company_calendar_event_updated_at
before update on public.company_calendar_events
for each row execute function public.set_company_calendar_event_updated_at();

alter table public.company_calendar_events enable row level security;

drop policy if exists company_calendar_events_select on public.company_calendar_events;
create policy company_calendar_events_select
on public.company_calendar_events
for select
to authenticated
using (is_active or public.is_manager());

drop policy if exists company_calendar_events_insert on public.company_calendar_events;
create policy company_calendar_events_insert
on public.company_calendar_events
for insert
to authenticated
with check (public.is_manager());

drop policy if exists company_calendar_events_update on public.company_calendar_events;
create policy company_calendar_events_update
on public.company_calendar_events
for update
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists company_calendar_events_delete on public.company_calendar_events;
create policy company_calendar_events_delete
on public.company_calendar_events
for delete
to authenticated
using (public.is_manager());

revoke all on public.company_calendar_events from anon;
grant select on public.company_calendar_events to authenticated;
grant insert, update, delete on public.company_calendar_events to authenticated;

insert into public.company_calendar_events (event_date, title, event_type, note)
values
  ('2026-01-26', 'Republic Day', 'government', 'Government holiday'),
  ('2026-03-04', 'Holi', 'government', 'Government holiday'),
  ('2026-03-21', 'Id-ul-Fitr', 'government', 'Government holiday'),
  ('2026-03-26', 'Ram Navami', 'government', 'Government holiday'),
  ('2026-03-31', 'Mahavir Jayanti', 'government', 'Government holiday'),
  ('2026-04-03', 'Good Friday', 'government', 'Government holiday'),
  ('2026-05-01', 'Buddha Purnima', 'government', 'Government holiday'),
  ('2026-05-27', 'Id-ul-Zuha (Bakrid)', 'government', 'Government holiday'),
  ('2026-06-26', 'Muharram', 'government', 'Government holiday'),
  ('2026-08-15', 'Independence Day', 'government', 'Government holiday'),
  ('2026-08-26', 'Milad-un-Nabi', 'government', 'Government holiday'),
  ('2026-09-04', 'Janmashtami', 'government', 'Government holiday'),
  ('2026-10-02', 'Gandhi Jayanti', 'government', 'Government holiday'),
  ('2026-10-19', 'Company Festival Break', 'company', 'Company-wide common leave'),
  ('2026-10-20', 'Dussehra', 'government', 'Government holiday'),
  ('2026-11-08', 'Diwali (Deepavali)', 'government', 'Government holiday'),
  ('2026-11-24', 'Guru Nanak''s Birthday', 'government', 'Government holiday'),
  ('2026-12-24', 'Christmas Eve Break', 'company', 'Company-wide common leave'),
  ('2026-12-25', 'Christmas Day', 'government', 'Government holiday'),
  ('2026-12-31', 'Year-end Common Leave', 'company', 'Company-wide common leave')
on conflict (event_date, title) do update
set event_type = excluded.event_type,
    note = excluded.note,
    is_active = true,
    updated_at = now();

comment on table public.company_calendar_events is
  'Shared government holidays and company-wide common leave shown in employee and HR dashboards.';
