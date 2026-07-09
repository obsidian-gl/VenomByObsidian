/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Retrieve credentials strictly from environment variables
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
    // No custom databaseId, standard default database is used
    adminDb = getFirestore(adminApp);
    console.log('Firebase Admin SDK initialized successfully for project:', projectId);
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
}

// Helper to ensure database is initialized on demand
function getDb() {
  if (!adminDb) {
    throw new Error('Firebase Admin SDK is not initialized. Check your environment variables.');
  }
  return adminDb;
}

// ----------------------------------------------------------------------------
// SERVER-SIDE COMPATIBILITY ADAPTER FOR ADMIN-STYLE CODE
// ----------------------------------------------------------------------------

class AdminDocRef {
  private mappedPath: string;

  constructor(private originalPath: string) {
    this.mappedPath = originalPath;
    
    // Map system/vapidKeys to posts/vapidKeys
    if (originalPath === 'system/vapidKeys') {
      this.mappedPath = 'posts/vapidKeys';
    } 
    // Map pushSubscriptions/{hash} to posts/pushSubscription_{hash}
    else if (originalPath.startsWith('pushSubscriptions/')) {
      const hash = originalPath.substring('pushSubscriptions/'.length);
      this.mappedPath = `posts/pushSubscription_${hash}`;
    }
  }

  async get() {
    try {
      const dbInstance = getDb();
      const docRef = dbInstance.doc(this.mappedPath);
      const snap = await docRef.get();
      return {
        exists: snap.exists,
        id: snap.id.startsWith('pushSubscription_') 
          ? snap.id.substring('pushSubscription_'.length) 
          : snap.id,
        data: () => snap.data()
      };
    } catch (err) {
      console.error(`Adapter read failed for path [${this.originalPath}] (mapped: [${this.mappedPath}]):`, err);
      throw err;
    }
  }

  async set(data: any, options?: any) {
    try {
      const dbInstance = getDb();
      const docRef = dbInstance.doc(this.mappedPath);
      if (options) {
        await docRef.set(data, options);
      } else {
        await docRef.set(data);
      }
    } catch (err) {
      console.error(`Adapter set failed for path [${this.originalPath}] (mapped: [${this.mappedPath}]):`, err);
      throw err;
    }
  }

  async delete() {
    try {
      const dbInstance = getDb();
      const docRef = dbInstance.doc(this.mappedPath);
      await docRef.delete();
    } catch (err) {
      console.error(`Adapter delete failed for path [${this.originalPath}] (mapped: [${this.mappedPath}]):`, err);
      throw err;
    }
  }
}

class AdminQuery {
  private adminQueryObj: any = null;

  constructor(private collectionPath: string) {
    const dbInstance = getDb();
    if (this.collectionPath === 'pushSubscriptions') {
      this.adminQueryObj = dbInstance.collection('posts');
    } else {
      this.adminQueryObj = dbInstance.collection(this.collectionPath);
    }
  }

  where(field: string, op: any, value: any) {
    this.adminQueryObj = this.adminQueryObj.where(field, op, value);
    return this;
  }

  limit(n: number) {
    this.adminQueryObj = this.adminQueryObj.limit(n);
    return this;
  }

  orderBy(field: string, dir: any = 'asc') {
    this.adminQueryObj = this.adminQueryObj.orderBy(field, dir);
    return this;
  }

  async get() {
    try {
      if (this.collectionPath === 'pushSubscriptions') {
        const dbInstance = getDb();
        const snap = await dbInstance.collection('posts').get();
        const docs = snap.docs
          .filter((docSnap: any) => docSnap.id.startsWith('pushSubscription_'))
          .map((docSnap: any) => ({
            id: docSnap.id.substring('pushSubscription_'.length),
            data: () => docSnap.data()
          }));
        return {
          empty: docs.length === 0,
          docs: docs
        };
      }

      const snap = await this.adminQueryObj.get();
      return {
        empty: snap.empty,
        docs: snap.docs.map((docSnap: any) => ({
          id: docSnap.id,
          data: () => docSnap.data()
        }))
      };
    } catch (err) {
      console.error(`Adapter collection get failed for [${this.collectionPath}]:`, err);
      throw err;
    }
  }

  async add(data: any) {
    try {
      if (this.collectionPath === 'notificationHistory') {
        const randomId = Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        const mappedDocPath = `posts/notificationHistory_${randomId}`;
        const enrichedData = {
          ...data,
          createdAt: new Date().toISOString()
        };

        const dbInstance = getDb();
        const docRef = dbInstance.doc(mappedDocPath);
        await docRef.set(enrichedData);
        return { id: randomId };
      }

      throw new Error(`Collection add operation is not mapped for [${this.collectionPath}]`);
    } catch (err) {
      console.error(`Adapter collection add failed for [${this.collectionPath}]:`, err);
      throw err;
    }
  }
}

class AdminDb {
  doc(path: string) {
    return new AdminDocRef(path);
  }

  collection(path: string) {
    return new AdminQuery(path);
  }
}

export const db = new AdminDb();
