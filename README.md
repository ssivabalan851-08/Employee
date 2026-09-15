<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/71721821-0c16-43ee-bbf0-9d062d651559

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Security and production setup

Public registration creates employee accounts only. Manager access requires a
verified Firebase custom claim and must be granted from a trusted administrator
workstation. See [Manager provisioning](docs/MANAGER_PROVISIONING.md).

Deploy the hardened Firestore rules after reviewing them:

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules
```

Run the complete local verification before opening a pull request:

```bash
npm run check
```

