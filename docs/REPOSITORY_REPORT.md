# Repository and Supabase migration report

## Product scope

The Enterprise Leave Portal provides two role-specific entry points. Employees can create accounts, sign in, view allowances, submit and cancel requests, read notifications, inspect activity, and export personal reports. Managers can review requests, process cancellations, inspect staff records and statistics, edit allowances, and export organization reports.

## Architecture

The browser application is React 19 with TypeScript, Vite, Tailwind CSS, and Lucide icons. `server.ts` serves the production bundle. Authentication and all durable application data now use Supabase over HTTPS.

| Area | Implementation |
| --- | --- |
| Authentication | Supabase email/password and optional Google OAuth |
| Profiles | `public.profiles` linked to `auth.users` |
| Allowances | `public.leave_balances`, one row per user |
| Requests | `public.leave_requests` with constrained types and statuses |
| Notifications | `public.notifications`, visible only to their owner |
| History | Append-only `public.audit_logs` |
| Privileged changes | Transactional Postgres functions with manager checks |
| Browser sessions | Memory only; every new page visit starts signed out |

## Security controls

Every application table has row-level security enabled. Employees can read only their own profile, balances, requests, notifications, and audit entries. Managers can read organization records. New accounts always receive the employee role.

The browser cannot directly approve a request, reject it, process a cancellation, or change balances. Those operations use `security definer` database functions that verify `auth.uid()` belongs to a manager and update all related records in one transaction. A trigger blocks employees from changing their role.

The client uses only the Supabase publishable key. The service-role key must remain outside the repository and browser environment.

## Database lifecycle

The initial migration is `supabase/migrations/202609150001_initial_schema.sql`. It creates types, tables, indexes, triggers, RLS policies, grants, and the following workflow functions:

- `submit_leave_request`
- `process_leave_request`
- `withdraw_leave_request`
- `request_leave_cancellation`
- `process_leave_cancellation`
- `update_employee_balance`

Apply migrations through the Supabase SQL editor or CLI before connecting a deployed build. Future schema changes should be new timestamped migration files; do not edit an already-applied production migration.

## Authentication behavior

The Supabase client keeps access tokens in JavaScript memory. It does not restore a previous account from local storage. Google OAuth temporarily keeps only the selected portal role in tab-scoped session storage so the role can be checked after the redirect. Closing the tab removes it.

The production URL must appear in Supabase Authentication URL Configuration. Google sign-in also requires a Google OAuth client configured with the Supabase callback URL shown by the dashboard.

## Branding

The new brand mark combines a calendar and approval check in an indigo-to-cyan gradient. It appears on the login page, authenticated header, printable approval statement, and browser favicon. The mark remains legible at small sizes and uses accessible SVG markup.

## Removed legacy paths

Firebase Authentication, Firestore configuration, rules, client code, administrator scripts, connection tests, browser demo records, demo accounts, and sample-data controls have been removed. The app has one production data path: Supabase.

## Deployment checklist

1. Create or select the Supabase project.
2. Apply the SQL migration.
3. Set the Site URL and allowed redirect URL.
4. Copy the project URL and publishable key into the build environment.
5. Enable email sign-in and configure Google if required.
6. Build and deploy the application.
7. Register one employee account, then grant the intended HR user the manager role using `docs/MANAGER_PROVISIONING.md`.
8. Verify employee submission, manager approval, balance adjustment, cancellation, notification, and CSV exports.

## Validation status

TypeScript checking and the production Vite build pass locally. Live sign-in and database workflow validation require the Supabase project, applied migration, and connection values.
