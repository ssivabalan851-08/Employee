import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

async function run() {
  try {
    const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
    console.log("Config loaded:", config.projectId, config.firestoreDatabaseId);
    
    const app = initializeApp(config);
    const db = getFirestore(app, config.firestoreDatabaseId);
    
    console.log("Attempting to read a test document from Firestore...");
    const docRef = doc(db, "users", "test-connection-id");
    
    // We set a 5-second timeout
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore getDoc timeout")), 5000));
    const result = await Promise.race([getDoc(docRef), timeout]);
    
    console.log("Success! Document read completed. Exists:", result.exists());
  } catch (err) {
    console.error("Firestore error:", err);
  }
  process.exit(0);
}

run();
