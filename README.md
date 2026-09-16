# Enterprise Leave Portal

A React and Supabase application for employee leave requests, balances, approvals, cancellations, notifications, audit history, and CSV reporting.

## Platform

- React 19, TypeScript, Vite, and Tailwind CSS
- Supabase Auth for email/password and Google sign-in
- Supabase Postgres for all application records
- Postgres row-level security (RLS) for employee and manager access
- Transactional database functions for approvals, cancellations, and balance changes
- Express production server and Sites hosting

The application deliberately starts signed out on every page visit. It does not include demo accounts, sample-data shortcuts, or stored browser sessions.

## Local setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/migrations/202609150001_initial_schema.sql`.
3. Copy `.env.example` to `.env.local` and add the project URL and publishable key.
4. In Supabase Authentication URL Configuration, set the production Site URL and add the local development URL when needed.
5. Enable Email authentication. Enable Google only after adding its client ID and secret in Supabase.
6. Install dependencies and run the app:

```bash
npm install
npm run dev
```

The local app starts at `http://localhost:3001`.

## Manager access

New accounts always start as employees. After the intended manager has registered, grant access from the Supabase SQL editor:

```sql
update public.profiles
set role = 'manager'
where email = 'manager@company.com';
```

See `docs/MANAGER_PROVISIONING.md` for operational guidance.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the local application |
| `npm run lint` | Check TypeScript |
| `npm run build` | Create the production build |
| `npm run check` | Run checks and build |
| `npm start` | Start the built server |

## Security model

The publishable Supabase key is a browser identifier, not an administrator secret. RLS is enabled on every application table. Employees can read only their own records. Managers can read organization records, while privileged workflow changes run through database functions that verify the caller's role and update the request, balance, notification, and audit trail in one transaction.

Never place the Supabase service-role key in this repository or any browser environment variable.
