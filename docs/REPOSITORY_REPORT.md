# LeaveWise repository and deployment report

## Current status

LeaveWise is a public employee leave management application with separate Employee and HR/Admin workspaces. The production site is:

https://employee-leave-portal.ssivabalan851.chatgpt.site

The application uses Supabase for authentication, profiles, leave data, account approval requests, and audit records. The current Sites production deployment is version 12.

## Product scope

Employees can create an account request, sign in after approval, view leave balances, submit and cancel leave requests, read notifications, inspect activity, and export personal reports.

HR users can request an HR account, sign in after approval, review leave requests, process cancellations, inspect staff records and statistics, edit allowances, and export organization reports.

The selected workspace is kept stable. Choosing HR and then switching between Create New Account and Sign In remains in the HR flow. The same behavior applies to Employee.

## Technology and architecture

| Area | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Lucide icons |
| Authentication | Supabase email/password |
| Profiles | `public.profiles`, linked to `auth.users` |
| Account approvals | `public.account_approval_requests` plus the `account-approval` Supabase Edge Function |
| Leave balances | `public.leave_balances`, one row per user |
| Leave requests | `public.leave_requests` with constrained types and statuses |
| Notifications | `public.notifications`, visible only to their owner |
| History | Append-only `public.audit_logs` |
| Privileged changes | Transactional PostgreSQL functions with manager checks |
| Email delivery | Brevo transactional email to the configured administrator only |
| Approval SMS | Brevo transactional SMS to the applicant's registered mobile number |
| Hosting | OpenAI Sites static deployment |
| Browser sessions | Memory only; every new page visit starts signed out |

## Account creation and approval flow

1. The applicant selects Employee Portal or HR & Admin Portal.
2. Create New Account asks for full name, email, mobile number, password, department, and job title.
3. Indian local mobile formats and `+91` formats are normalized to E.164 before storage. Other valid international E.164 numbers are accepted.
4. Supabase creates the authentication identity and the database trigger creates the profile and leave balances.
5. The account remains pending. The Edge Function creates or repairs the approval request and sends an approval email only to `ADMIN_APPROVAL_EMAIL`.
6. The administrator uses the Approve or Reject action in the email.
7. Approval changes the user's profile to active. HR requests receive the manager role; Employee requests receive the employee role.
8. After approval, the Edge Function sends a short SMS to the registered applicant mobile number. It does not send an applicant decision email.
9. The applicant signs in through the same portal that was selected during registration.

Supabase email confirmation is disabled for this project, so a new applicant does not need to confirm an email address. The application also does not send its own confirmation email to the applicant.

## Failure handling

- A duplicate signup reports that the account already exists and directs the person to sign in.
- A pending user who signs in causes the application to retry the administrator notification when needed.
- Browser requests cannot read or modify the private approval queue directly.
- The Edge Function uses the service role for approval records and profile activation.
- If the administrator email cannot be sent, the account stays pending and can be retried.
- If approval succeeds but SMS delivery fails, approval remains saved. Reopening the approval link retries the SMS and stores the latest provider error for support.

## Database migrations

The initial schema is `supabase/migrations/202609150001_initial_schema.sql`.

The approval and SMS update is `supabase/migrations/202609170001_account_approval_sms.sql`. It:

- adds `profiles.phone_number`;
- adds E.164 validation;
- adds approval SMS audit columns;
- repairs pending approval rows;
- grants the required approval-table access to `service_role` while keeping browser roles blocked;
- updates `handle_new_user()` so the applicant mobile number is stored from signup metadata.

Future database changes should use a new timestamped migration. Do not rewrite a migration that has already been applied in production.

## Security controls

Every application table has row-level security enabled. Employees can read their own profile, balances, requests, notifications, and audit entries. HR users can read the organization records required by their workspace.

The browser cannot directly approve an account, reject a request, process a cancellation, or change leave balances. Privileged operations run in database functions or the Edge Function and verify the caller or approval token.

The frontend uses only the Supabase publishable key. The Supabase service-role key and Brevo API key are stored as Supabase Edge Function secrets and must never be placed in frontend code, repository files, browser storage, or screenshots.

## Where data can be inspected

- Authentication identities: Supabase Dashboard > Authentication > Users.
- User name, role, approval status, and phone: Table Editor > `profiles`.
- Pending and completed account requests: Table Editor > `account_approval_requests`.
- SMS delivery status: the `approval_sms_*` columns in `account_approval_requests`.
- Approval function activity: Edge Functions > `account-approval` > Logs.
- Leave data: `leave_balances`, `leave_requests`, `notifications`, and `audit_logs`.

Supabase never displays user passwords. Passwords are managed by Supabase Auth and stored as secure hashes.

## Required service configuration

The `account-approval` Edge Function expects these secrets:

- `ADMIN_APPROVAL_EMAIL`
- `BREVO_API_KEY`
- `BREVO_SMS_SENDER` (optional; defaults to `LeaveWise`)
- Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`

Brevo SMS delivery also requires SMS credit and an approved Sender ID where required by the destination country. Missing credit or Sender ID configuration does not undo account approval; it is recorded as an SMS delivery error.

## Validation completed

- TypeScript type checking passed.
- The production Vite build passed.
- The production archive was created from the exact pushed Sites commit.
- Migration verification returned `true` for the phone column, SMS audit columns, and `service_role` approval-table permission.
- The `account-approval` Edge Function was deployed successfully.
- Sites version 12 was deployed successfully with public access preserved.
- The live Employee signup form includes the mobile-number field.
- The live HR signup form includes the same account details and remains in HR mode.
- The live HR sign-in form remains selected after switching from HR signup.
- Supabase Auth shows email confirmation disabled.

## Operational test procedure

1. Open the production URL in a private browser window.
2. Select Employee Portal and create a test account with a reachable mobile number.
3. Confirm that only the administrator mailbox receives the approval email.
4. Open the approval link and approve the request.
5. Confirm that the applicant phone receives the approval SMS.
6. Sign in through Employee Portal and submit a leave request.
7. Repeat with an HR account and confirm that the approved account opens the HR workspace.
8. Review `account_approval_requests` and Edge Function logs if an email or SMS is delayed.

Do not use a production employee's email or phone number for testing without their consent.
