/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

let adminDb: any = null;

if (!projectId || !clientEmail || !privateKey) {
  console.warn(
    'Warning: Firebase Admin credentials are not fully configured via environment variables. ' +
    'Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
  );
} else {
  try {
    const cleanPrivateKey = privateKey.replace(/\\n/g, '\n');
    let adminApp;
    if (getApps().length > 0) {
      adminApp = getApp();
    } else {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: cleanPrivateKey,
        }),
      });
    }
    adminDb = getFirestore(adminApp);
    console.log('Firebase Admin SDK initialized successfully for project:', projectId);
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
}

// Lazy Proxy for Db to prevent module-load crashes when variables are missing or unconfigured
const dbProxy = new Proxy({} as any, {
  get(target, prop) {
    if (!adminDb) {
      throw new Error(
        'Firebase Admin SDK is not initialized. Please check that FIREBASE_PROJECT_ID, ' +
        'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are properly configured in your environment.'
      );
    }
    return adminDb[prop];
  }
});

export { dbProxy as db };
