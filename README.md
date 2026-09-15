# Employee Leave Management System

A React and Firebase application for managing employee leave requests, approvals, balances, cancellations, notifications, and audit history.

## Current features

### Employee portal

- Email/password and Google sign-in
- Demo accounts for local evaluation
- Leave balance overview
- Business-day leave calculation
- Leave request submission and history
- Withdrawal and cancellation workflows
- Approval report printing
- Notifications and activity history

### Manager portal

- Pending, approved, rejected, and cancellation request review
- Employee and department filtering
- Leave statistics
- Employee leave-limit editing
- Notifications and audit records
- Demo data seeding

## Technology

- React 19 and TypeScript
- Vite 6
- Tailwind CSS 4
- Firebase Authentication
- Cloud Firestore
- Express production server
- npm or Bun dependency management

## Project structure

```text
.
├── server.ts                         Express/Vite server
├── firestore.rules                   Firestore authorization rules
├── firebase-applet-config.json       Firebase client configuration
├── firebase-blueprint.json           Firestore data model
└── src
    ├── App.tsx                       Authenticated application shell
    ├── components
    │   ├── LoginScreen.tsx
    │   ├── EmployeeDashboard.tsx
    │   ├── ManagerDashboard.tsx
    │   └── NotificationCenter.tsx
    ├── lib
    │   ├── auth-context.tsx          Authentication and profile state
    │   ├── db-service.ts             Firestore and demo-data operations
    │   └── firebase.ts               Firebase initialization
    └── types.ts                      Shared domain types
```

## Local setup

### Prerequisites

- Node.js 20 or newer
- npm
- A Firebase project with Authentication and Firestore enabled

### Install and run

```bash
npm install
npm run dev
```

The application starts on `http://localhost:3001` by default.

### Firebase setup

1. Create a Firebase web application.
2. Enable Email/Password and Google providers under Firebase Authentication.
3. Create a Firestore database.
4. Replace the values in `firebase-applet-config.json` with the configuration for your project.
5. Review and deploy `firestore.rules` only after completing the security work described in [docs/REPOSITORY_REPORT.md](docs/REPOSITORY_REPORT.md).

Firebase web configuration identifies the project and is not an administrator secret. Never commit service-account credentials or private keys.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Express with Vite development middleware |
| `npm run lint` | Type-check the TypeScript source |
| `npm run build` | Build the client and production server |
| `npm start` | Start the built production server |

## Production build

```bash
npm run lint
npm run build
NODE_ENV=production npm start
```

On Windows PowerShell, set the environment variable with:

```powershell
$env:NODE_ENV = "production"
npm start
```

## Known security status

The current code is suitable for demonstration and development. It should not handle real employee data until role assignment and leave mutations are moved behind trusted server-side authorization and the Firestore rules are tightened. See [docs/REPOSITORY_REPORT.md](docs/REPOSITORY_REPORT.md) for findings and an ordered remediation plan.
