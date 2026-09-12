import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
// Explicitly initialize with custom database ID from config to avoid any collision
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export { app };

