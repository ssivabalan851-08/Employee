import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/set-manager-role.mjs manager@example.com");
  process.exit(1);
}

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credential = credentialPath
  ? cert(JSON.parse(fs.readFileSync(credentialPath, "utf8")))
  : applicationDefault();

const app = getApps()[0] ?? initializeApp({ credential });
const auth = getAuth(app);
const db = getFirestore(app);
const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims ?? {}),
  manager: true,
});
await db.doc(`users/${user.uid}`).set({ role: "manager" }, { merge: true });

console.log(`Manager access granted to ${email}. The user must sign out and back in.`);

