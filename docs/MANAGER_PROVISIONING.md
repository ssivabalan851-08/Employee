# Manager provisioning

Manager access is privileged. The public registration form always creates an employee account.

## Prerequisites

1. Create and download a Firebase service-account JSON file from a trusted administrator workstation.
2. Store it outside this repository.
3. Set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path.
4. Install dependencies with `npm install`.

## Grant manager access

```bash
node scripts/set-manager-role.mjs manager@example.com
```

The script adds the verified Firebase `manager` custom claim and updates the user's profile. The user must sign out and sign back in to refresh the ID token.

Never commit the service-account JSON file. To revoke access, remove the custom claim with an administrator script or Firebase Admin tooling and change the profile role back to `employee`.

