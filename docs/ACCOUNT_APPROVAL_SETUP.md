# LeaveWise account approval setup

## Result

Every employee and HR registration creates a pending account. The administrator receives a branded email containing the applicant's name, email address, requested access, department, and job title. Approve and Reject links open a confirmation page before saving the decision. The applicant then receives a branded approval or rejection email.

Existing accounts are marked approved when the migration is applied, so the change does not lock out current users.

## Email address rule

Both portals accept addresses with letters followed by at least one number and a normal domain. Examples:

- `john123@company.com`
- `hr25@gmail.com`

Addresses without a number before `@`, such as `john@company.com`, are rejected with an explanation.

## Required Supabase secrets

Set these as Edge Function secrets. Never add them to a browser variable or commit them to Git.

| Secret | Purpose | Example |
| --- | --- | --- |
| `BREVO_API_KEY` | Recommended free transactional sender when using a verified Gmail address | Created in Brevo |
| `BREVO_SENDER_EMAIL` | Verified sender address in Brevo | `ssivabalan851@gmail.com` |
| `BREVO_SENDER_NAME` | Professional sender name | `LeaveWise Accounts` |
| `RESEND_API_KEY` | Optional alternative when using a verified company domain | Created in Resend |
| `ADMIN_APPROVAL_EMAIL` | Receives new account requests | `ssivabalan851@gmail.com` |
| `APPROVAL_CONTACT_EMAIL` | Shown to applicants for clarification | `ssivabalan851@gmail.com` |
| `APPROVAL_CONTACT_PHONE` | Shown to applicants for clarification | Company HR number |
| `APPROVAL_FROM_EMAIL` | Branded sender on a verified domain | `LeaveWise Accounts <accounts@yourdomain.com>` |
| `SITE_URL` | Opens the production application | `https://employee-leave-portal.ssivabalan851.chatgpt.site` |

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function. The service-role key must remain server-side.

## Mail sender

For a Gmail sender, use Brevo and verify the sender address from the verification email it sends. Set `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME`. The function automatically prefers Brevo when that key is present.

Resend remains supported as an alternative for a company-owned domain. Its test sender can deliver only to the account owner's address, so arbitrary employee delivery requires a verified domain and `APPROVAL_FROM_EMAIL` on that domain.

## Deployment order

1. Configure the contact settings and one email provider in Supabase.
2. Deploy `supabase/functions/account-approval` with JWT verification disabled as specified by `supabase/config.toml`. The function performs its own validation because unconfirmed sign-ups do not yet have a session token.
3. Run `supabase/migrations/202609160001_account_approval.sql` in the Supabase SQL editor.
4. Deploy the web application.
5. Create one employee test account and one HR test account.
6. Confirm that the administrator email arrives, that its review link opens a confirmation page, and that the applicant receives the correct decision email.

This order keeps the existing production sign-in flow available until email delivery is ready.

## Security behavior

- Approval tokens are random, one-time values. Only SHA-256 hashes are stored in the database.
- Opening an email link does not change an account. A second explicit confirmation is required, which prevents mail scanners from approving or rejecting users.
- Browser clients cannot read the approval request table.
- Pending users cannot submit leave requests.
- Only approved HR accounts satisfy the manager authorization check.
- Existing accounts remain approved during migration.

## Viewing registered accounts

In Supabase, open **Authentication → Users** to view sign-in identities. Open **Table Editor → profiles** to view each account's requested role and `approval_status`. Open **Table Editor → account_approval_requests** to see when the administrator and applicant emails were sent and which decision was recorded.
