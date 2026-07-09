/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let projectId = 'alert-thought-dcf5x';
let databaseId = 'ai-studio-0c99792f-ea71-4254-86fb-ce2d8e4881d5';

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.projectId) projectId = parsed.projectId;
    if (parsed.firestoreDatabaseId) databaseId = parsed.firestoreDatabaseId;
  }
} catch (err) {
  console.error('Failed to parse firebase-applet-config.json:', err);
}

let app;
const apps = getApps();
if (apps.length > 0) {
  app = apps[0];
} else {
  // Try service account configuration from environment variables (essential for Vercel)
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  let cred;
  if (serviceAccountVar) {
    try {
      const sa = JSON.parse(serviceAccountVar);
      cred = cert(sa);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    }
  } else if (privateKey && clientEmail) {
    cred = cert({
      projectId: process.env.FIREBASE_PROJECT_ID || projectId,
      clientEmail: clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
  }

  if (cred) {
    app = initializeApp({
      credential: cred,
      projectId: process.env.FIREBASE_PROJECT_ID || projectId,
    });
  } else {
    // Falls back to Google Application Default Credentials or local ADC config
    app = initializeApp({
      projectId: projectId,
    });
  }
}

// Get the firestore database instance with custom databaseId using standard getFirestore helper
const db = getFirestore(app, databaseId);
db.settings({ ignoreUndefinedProperties: true });

export { db, app };
