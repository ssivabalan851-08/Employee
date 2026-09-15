# Repository Assessment and Improvement Plan

Assessment date: 2026-09-15  
Repository: `ssivabalan851-08/Employee`  
Reviewed branch: `main` at commit `998aad0b39964ac3f99fb685b4220b6956b7293e`

## 1. Executive summary

This repository implements a complete employee leave-management prototype with separate employee and manager experiences. The user interface covers the main business workflow well: sign-in, leave balances, request submission, approval or rejection, cancellation, reporting, notifications, and audit history.

The largest gap is the trust boundary. Sensitive authorization and workflow decisions currently run in the browser. A user can choose a manager role, and the Firestore rules allow several protected fields to be changed from the client. This is acceptable for a demo but unsafe for real HR information.

Recommended approach:

1. Keep the existing React interface.
2. Introduce trusted server-side endpoints or Firebase Cloud Functions for privileged operations.
3. Assign roles through Firebase custom claims or an administrator-only process.
4. Restrict Firestore writes by field and valid state transition.
5. Add automated tests for rules and leave-balance transactions.
6. Split the large dashboard and database files into smaller modules.

## 2. Architecture

### Client

`src/main.tsx` mounts the application. `src/App.tsx` wraps it in `AuthProvider`, shows the login screen when signed out, and selects a dashboard from the stored user role.

`LoginScreen.tsx` supports employee and manager tabs, email/password authentication, Google authentication, account registration, and demo profiles.

`EmployeeDashboard.tsx` handles leave balances, business-day calculation, requests, cancellation, audit activity, and printable approval reports.

`ManagerDashboard.tsx` handles request review, statistics, employee filtering, leave-limit editing, and sample-data seeding.

`NotificationCenter.tsx` polls Firestore every 30 seconds and allows the signed-in user to mark notifications as read.

### Data and authentication

`auth-context.tsx` combines Firebase Authentication with a browser-based demo mode. The value called `token` is normally a Firebase UID rather than a verified Firebase ID token.

`db-service.ts` contains both demo storage and Firestore operations. Demo records are stored in `localStorage`; cloud records use the Firebase client SDK.

Main Firestore collections:

- `users`
- `leave_balances`
- `leave_requests`
- `notifications`
- `audit_logs`

### Server

`server.ts` provides a health endpoint and serves Vite middleware in development or static assets in production. It does not currently enforce leave-management authorization or perform privileged database operations.

## 3. Business workflows

### Leave submission

The employee selects a leave category and date range. Business days exclude Saturday and Sunday. The service validates the remaining balance and creates a pending leave request.

### Manager decision

A manager can approve or reject a pending request. Approval uses a Firestore transaction to update the leave balance and request state. A notification and audit event are then created.

### Cancellation

A pending request can be cancelled. An approved future request enters `cancellation_pending`; a manager can approve the cancellation and restore the balance or reject it and return the request to `approved`.

### Demo mode

Known demo IDs and locally registered accounts bypass Firebase-backed data and use browser storage. This helps demonstrations but must be clearly isolated from production behavior.

## 4. Findings

### Critical: users can obtain or change manager privileges

Registration accepts a role chosen by the browser. The profile-loading path can also replace an existing cloud profile role with the selected portal role. Firestore permits an owner to update their own user record, including `role`.

Impact: a signed-in employee can potentially become a manager and gain access to all employee and leave records.

Required fix:

- Never accept a privileged role from registration or portal selection.
- Default new accounts to `employee`.
- Assign manager access through Firebase custom claims or a trusted administrator endpoint.
- Prevent clients from changing `role`, `uid`, and other protected identity fields.

### Critical: leave state and balances can be changed by clients

Firestore allows employees to update their own leave requests and balances without restricting changed fields or state transitions.

Impact: an employee can potentially approve a request, change its duration, alter used balances, or rewrite audit-related fields through a direct Firestore call.

Required fix:

- Move approvals, rejections, cancellations, and balance changes to server-side transactions.
- Allow employees to create requests with a strict schema.
- Permit only narrowly defined employee transitions where appropriate.
- Validate dates, duration, category, ownership, and immutable fields in rules and trusted code.

### High: locally registered passwords are stored in plaintext

The demo fallback saves registration details, including the password, in `localStorage`.

Impact: any script running in the site origin, browser extension with access, or person using the browser profile can read these credentials.

Required fix:

- Remove password persistence entirely.
- Use Firebase Authentication for real accounts.
- For offline demos, use fixed demo profiles without passwords or store only non-sensitive mock state.
- Clear existing `local_registered_users` data during migration.

### High: audit logs and notifications are forgeable

Any signed-in user can create audit logs and notifications. Audit logs are readable by every signed-in user.

Impact: users can create misleading records, notify other users, and view organization-wide activity.

Required fix:

- Write audit logs and workflow notifications only from trusted server code.
- Restrict audit-log reads by role and ownership.
- Validate notification recipients and fields.

### High: all user profiles are readable

The `users` collection allows every authenticated user to read every user document.

Impact: employee email, department, title, and related profile data may be exposed beyond business need.

Required fix:

- Let employees read their own profile.
- Let managers read only fields and departments required by the application.
- Consider a separate minimal directory collection if organization-wide display data is needed.

### Medium: the application treats a UID as a token

The client uses a variable named `token`, but the value is usually `user.uid`. It is passed to database methods as identity.

Impact: future server endpoints may mistakenly treat a user-controlled UID as authentication.

Required fix:

- Rename it to `userId` where it is only an identifier.
- When calling a server, obtain an actual Firebase ID token with `getIdToken()`.
- Verify ID tokens with Firebase Admin on every protected endpoint.

### Medium: error handling can hide operational failures

Notifications are created outside some main transactions, and errors can leave business state updated without a matching notification or audit record. Several errors are logged to the browser without a visible retry path.

Required fix:

- Perform the state change, balance update, and audit creation in one trusted transaction when possible.
- Record retryable notification work separately.
- Show actionable errors and preserve enough context for a safe retry.

### Medium: large files reduce maintainability

`db-service.ts`, `EmployeeDashboard.tsx`, `ManagerDashboard.tsx`, and `LoginScreen.tsx` contain many unrelated responsibilities.

Required fix:

- Split database operations by domain: profiles, leaves, balances, notifications, and audit.
- Extract dashboard sections and dialogs into components.
- Move workflow validation into pure functions with unit tests.

### Medium: schema definitions have drifted

`src/types.ts`, `firebase-blueprint.json`, and the actual database service disagree about statuses and duplicated fields such as `uid`/`employeeId`, `duration`/`totalDays`, and `applicationDate`/`createdAt`.

Required fix:

- Select one canonical field per concept.
- Add a migration for existing documents.
- Generate or validate types from one schema source.
- Include cancellation and audit states in the blueprint.

### Low: repository hygiene and developer experience

The repository contains both `bun.lock` and `package-lock.json`, while documentation only describes npm. The `clean` script uses a Unix command and is not portable to default Windows shells. No automated test script is defined.

Required fix:

- Choose npm or Bun and keep one lockfile.
- Replace the clean command with a cross-platform utility or small Node script.
- Add focused tests for workflow rules and transactions.
- Add CI for type-checking, tests, and builds.

## 5. Ordered implementation plan

### Phase 1: block privilege escalation

1. Make all new accounts employees.
2. Remove role updates from client profile operations.
3. Add Firebase custom claims for managers.
4. Update the app to derive the manager view from verified claims.
5. Tighten `users` rules so users cannot edit role or identity fields.

### Phase 2: protect leave workflows

1. Add callable Cloud Functions or authenticated Express endpoints.
2. Implement submit, approve, reject, request-cancellation, approve-cancellation, and reject-cancellation operations.
3. Verify the Firebase ID token server-side.
4. Run status and balance changes in Firestore transactions.
5. Write audit records inside the trusted operation.
6. Restrict direct client writes to protected collections.

### Phase 3: remove unsafe local authentication

1. Delete local password registration and sign-in.
2. Keep fixed, clearly labelled demo profiles only in development.
3. Gate demo mode with an explicit build-time environment flag.
4. Clear legacy browser credentials.

### Phase 4: stabilize the model

1. Define canonical schemas for user, balance, request, audit, and notification.
2. Write a one-time migration for duplicate fields.
3. Add Firestore emulator tests for every allowed and denied operation.
4. Add unit tests for business-day calculations and state transitions.

### Phase 5: refactor the interface

1. Extract reusable request tables, filters, modals, balance cards, and report components.
2. Create hooks for employee and manager data.
3. Replace polling with Firestore snapshot listeners where appropriate.
4. Add accessible dialog focus management and form validation.

## 6. Suggested production data rules

The final rules should enforce these principles:

- A user reads their own full profile.
- A user cannot write their role or identity.
- A manager claim controls privileged reads and writes.
- An employee creates only a pending request owned by their UID.
- Request ownership and immutable application fields never change.
- Approval and balance changes occur through trusted server code.
- Audit logs are append-only and server-created.
- Notifications are server-created; recipients can only mark their own as read or delete them.

Firestore rules are a second line of protection. Business-critical transactions should still run on a trusted server.

## 7. Verification checklist

Before production use:

- [ ] Employee cannot register or switch to manager.
- [ ] Employee cannot modify their role using the Firestore SDK.
- [ ] Employee cannot edit used or total leave balances.
- [ ] Employee cannot approve, reject, or rewrite a request.
- [ ] Employee cannot create audit records or notifications.
- [ ] Manager claims are issued only by an administrator.
- [ ] Every endpoint rejects missing, expired, or invalid ID tokens.
- [ ] Concurrent approvals cannot deduct a balance twice.
- [ ] Rejected and repeated transitions return a clear error.
- [ ] Firestore emulator rule tests pass.
- [ ] Type-check, automated tests, and production build pass in CI.
- [ ] No passwords, service-account keys, or private keys exist in the repository.

## 8. How to continue development

For each requested change:

1. Start from the latest `main`.
2. Create a small feature branch.
3. Make one focused change.
4. Run `npm run lint` and `npm run build`.
5. For data or authorization changes, run Firestore emulator tests.
6. Open a pull request describing behavior before and after the change.
7. Review security rules and migration needs.
8. Merge only after checks pass.
9. Deploy rules, server functions, and client in a coordinated release.
10. Monitor authentication failures, transaction errors, and unexpected status transitions.

The best next implementation is Phase 1: remove client-controlled manager roles and add trusted role claims. It closes the most serious access-control gap before further features are added.
