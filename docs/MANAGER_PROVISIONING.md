# Manager provisioning

Public registration creates employee accounts only. Manager access must be granted by an authorized Supabase project administrator.

1. Ask the manager to create an account through the Employee portal and confirm their email.
2. In the Supabase dashboard, open **SQL Editor**.
3. Run the following statement with the manager's exact verified email:

```sql
update public.profiles
set role = 'manager'
where email = 'manager@company.com';
```

4. Confirm one row was updated.
5. The manager can then use the **HR & Admin Portal** on their next sign-in.

To revoke manager access, update the same profile back to `employee`. Do not grant roles from browser code or edit the migration to make new accounts managers by default.

## Where to view accounts

- Open **Supabase Dashboard → Authentication → Users** to see every registered account, confirmation status, creation time, and last sign-in time.
- Open **Supabase Dashboard → Table Editor → profiles** to see each account's application role, department, and job title.
- Open **Supabase Dashboard → Logs → Auth Logs** to review recent sign-in and authentication events.

The portal uses memory-only sessions, so closing or refreshing the page requires a fresh sign-in. The **Last sign-in** field and Auth Logs provide the account activity history; the application does not maintain a separate persistent “currently online” list.
