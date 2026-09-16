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
