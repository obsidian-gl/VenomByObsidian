/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp as initAdminApp, getApps as getAdminApps, getApp as getAdminApp, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let projectId = 'alert-thought-dcf5x';
let databaseId = 'ai-studio-0c99792f-ea71-4254-86fb-ce2d8e4881d5';
let apiKey = '';

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.projectId) projectId = parsed.projectId;
    if (parsed.firestoreDatabaseId) databaseId = parsed.firestoreDatabaseId;
    if (parsed.apiKey) apiKey = parsed.apiKey;
  }
} catch (err) {
  console.error('Failed to parse firebase-applet-config.json:', err);
}

// Check for Service Account in environment variables (Vercel / Production)
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY;

let useAdminSdk = false;
let adminDb: any = null;

if (clientEmail && privateKey) {
  try {
    const cleanPrivateKey = privateKey.replace(/\\n/g, '\n');
    let adminApp;
    if (getAdminApps().length > 0) {
      adminApp = getAdminApp();
    } else {
      adminApp = initAdminApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || projectId,
          clientEmail,
          privateKey: cleanPrivateKey,
        }),
      });
    }
    adminDb = getAdminFirestore(adminApp, databaseId);
    useAdminSdk = true;
    console.log('Firebase Admin SDK initialized successfully using Service Account.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK with Service Account, falling back:', err);
  }
} else {
  console.log('No Service Account environment variables found. Using dynamic client SDK fallback for container dev mode.');
}

let clientDbInstance: any = null;

async function getClientDb() {
  if (clientDbInstance) return clientDbInstance;

  const { initializeApp: initClientApp, getApps: getClientApps } = await import('firebase/app');
  const { initializeFirestore: initClientFirestore } = await import('firebase/firestore');

  const firebaseConfig = {
    apiKey: apiKey || process.env.VITE_FIREBASE_API_KEY,
    projectId: projectId,
    appId: '1:193424098563:web:bb8645417b498a754d5536',
  };

  let clientApp;
  const apps = getClientApps();
  if (apps.length > 0) {
    clientApp = apps[0];
  } else {
    clientApp = initClientApp(firebaseConfig);
  }

  clientDbInstance = initClientFirestore(clientApp, {
    ignoreUndefinedProperties: true
  }, databaseId);

  return clientDbInstance;
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
      if (useAdminSdk) {
        const docRef = adminDb.doc(this.mappedPath);
        const snap = await docRef.get();
        return {
          exists: snap.exists,
          id: snap.id.startsWith('pushSubscription_') 
            ? snap.id.substring('pushSubscription_'.length) 
            : snap.id,
          data: () => snap.data()
        };
      } else {
        const cDb = await getClientDb();
        const { doc: clientDoc, getDoc: getClientDoc } = await import('firebase/firestore');
        const dRef = clientDoc(cDb, this.mappedPath);
        const snap = await getClientDoc(dRef);
        return {
          exists: snap.exists(),
          id: snap.id.startsWith('pushSubscription_') 
            ? snap.id.substring('pushSubscription_'.length) 
            : snap.id,
          data: () => snap.data()
        };
      }
    } catch (err) {
      console.error(`Adapter read failed for path [${this.originalPath}] (mapped: [${this.mappedPath}]):`, err);
      throw err;
    }
  }

  async set(data: any, options?: any) {
    try {
      if (useAdminSdk) {
        const docRef = adminDb.doc(this.mappedPath);
        if (options) {
          await docRef.set(data, options);
        } else {
          await docRef.set(data);
        }
      } else {
        const cDb = await getClientDb();
        const { doc: clientDoc, setDoc: setClientDoc } = await import('firebase/firestore');
        const dRef = clientDoc(cDb, this.mappedPath);
        if (options) {
          await setClientDoc(dRef, data, options);
        } else {
          await setClientDoc(dRef, data);
        }
      }
    } catch (err) {
      console.error(`Adapter set failed for path [${this.originalPath}] (mapped: [${this.mappedPath}]):`, err);
      throw err;
    }
  }

  async delete() {
    try {
      if (useAdminSdk) {
        const docRef = adminDb.doc(this.mappedPath);
        await docRef.delete();
      } else {
        const cDb = await getClientDb();
        const { doc: clientDoc, deleteDoc: deleteClientDoc } = await import('firebase/firestore');
        const dRef = clientDoc(cDb, this.mappedPath);
        await deleteClientDoc(dRef);
      }
    } catch (err) {
      console.error(`Adapter delete failed for path [${this.originalPath}] (mapped: [${this.mappedPath}]):`, err);
      throw err;
    }
  }
}

class AdminQuery {
  private constraints: any[] = [];
  private adminQueryObj: any = null;

  constructor(private collectionPath: string) {
    if (useAdminSdk) {
      if (this.collectionPath === 'pushSubscriptions') {
        this.adminQueryObj = adminDb.collection('posts');
      } else {
        this.adminQueryObj = adminDb.collection(this.collectionPath);
      }
    }
  }

  where(field: string, op: any, value: any) {
    if (useAdminSdk) {
      this.adminQueryObj = this.adminQueryObj.where(field, op, value);
    } else {
      this.constraints.push({ type: 'where', field, op, value });
    }
    return this;
  }

  limit(n: number) {
    if (useAdminSdk) {
      this.adminQueryObj = this.adminQueryObj.limit(n);
    } else {
      this.constraints.push({ type: 'limit', n });
    }
    return this;
  }

  orderBy(field: string, dir: any = 'asc') {
    if (useAdminSdk) {
      this.adminQueryObj = this.adminQueryObj.orderBy(field, dir);
    } else {
      this.constraints.push({ type: 'orderBy', field, dir });
    }
    return this;
  }

  async get() {
    try {
      if (useAdminSdk) {
        if (this.collectionPath === 'pushSubscriptions') {
          const snap = await adminDb.collection('posts').get();
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
      } else {
        const cDb = await getClientDb();
        const { collection: clientCollection, getDocs: getClientDocs, query: clientQuery, where: clientWhere, limit: clientLimit, orderBy: clientOrderBy } = await import('firebase/firestore');

        if (this.collectionPath === 'pushSubscriptions') {
          const collRef = clientCollection(cDb, 'posts');
          const snap = await getClientDocs(clientQuery(collRef, clientOrderBy('createdAt', 'desc')));
          const docs = snap.docs
            .filter(docSnap => docSnap.id.startsWith('pushSubscription_'))
            .map(docSnap => ({
              id: docSnap.id.substring('pushSubscription_'.length),
              data: () => docSnap.data()
            }));
          return {
            empty: docs.length === 0,
            docs: docs
          };
        }

        const collRef = clientCollection(cDb, this.collectionPath);
        const queryConstraints = this.constraints.map(c => {
          if (c.type === 'where') return clientWhere(c.field, c.op, c.value);
          if (c.type === 'limit') return clientLimit(c.n);
          if (c.type === 'orderBy') return clientOrderBy(c.field, c.dir);
          return null;
        }).filter(Boolean);

        const q = clientQuery(collRef, ...queryConstraints);
        const snap = await getClientDocs(q);
        return {
          empty: snap.empty,
          docs: snap.docs.map(docSnap => ({
            id: docSnap.id,
            data: () => docSnap.data()
          }))
        };
      }
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

        if (useAdminSdk) {
          const docRef = adminDb.doc(mappedDocPath);
          await docRef.set(enrichedData);
        } else {
          const cDb = await getClientDb();
          const { doc: clientDoc, setDoc: setClientDoc } = await import('firebase/firestore');
          const dRef = clientDoc(cDb, mappedDocPath);
          await setClientDoc(dRef, enrichedData);
        }
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
