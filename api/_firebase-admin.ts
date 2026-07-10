/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'venom-notifications';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@venom-notifications.iam.gserviceaccount.com';
const privateKey = process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCx+mIv6tLMRjRO
70LXGI9n2UXdWQ2SibgRorh+gAgzr01gN0/lIBPFLhKzbxgg04xx+xmr/e5OU6dC
OSbFagjIEqY5YYqIhDi4bnMIK5yqGHtLHRwTfjMbAgj03ko4g8WMGTb5sSYiu5xX
0selDgn37h5EaaxRWbOtf+kLIFZvKDsBZ694fW+h5/3uFh/DF4g6ZcnWfsLXWQfF
lRw9FRwevPNS9zIGLl8E/zzcKimEA2zf8e/7H7lchqaRE8z8EC7na+Xo7Z/72tY8
FkOs1S8sjU0R9qM0PbLyyHBUvUoGLoGI5dsq3xeGfcyZ0FWnLyM6Gx1b5Wuubq7y
Ot19Y8WxAgMBAAECggEACZQktFh/4jTwZsPTcJkmoAZeZLnWFFTA09jSniL3jgnk
G7FjuudS47ywOU5ZhEFudcn3s+fVlgtEMrkPCvaYehAgOHFf+oCclDcu42SEKNbA
IqbylmKnOc+5D1i8B4uhVldwZoLavxQi0h/gKn7KxDhhZ6Qvp9cwkj4Smvcxal0E
ndIRqmQBTWxEkevBMM6KXrZ4FhhN+zk37sRv30ka4vyshNGs4d5i11vQPOXucyxW8
SkJ+YXLeRofi92ZrIPizgKEH9aMRwoVNW+651A2TfdtVsItQz4C51gwyrz5osSez
e6hwc1t1Kr7BdL/hAx2fVez611je8PzJ9ZYLjRIfowKBgQDXKnAox9QZ5ENPId94
dBZZ+7sc4semDfrFwrLsbrdmlrxJHBRu7Q6XIE9G48PZhuaGt3WRLR5onAc4JkBf
Q7223I4aGDu9YSiaw7cO9M6R7Zxf2k5CtSqJZXWsXjAB57X1NDI1VG2Hk4kI24A3
s9FUAtYuz6VFrBvWVIys5W073wKBgQDTwToAKGk+2YnDtPGVfsbgZnAX/NKXpFTo
TvKFrJPBRd4Q1po3DqK4CO+f09TX1MTI1hyXa8Au6bxAzfEJ96wVEYRfLPpEOrF3
g0Ct7jm4FLl8EAqAvB+oXWgAmGvsixHWkNPRHB1Ozmr+fwLr+uSRpAsEqS6sEt38
I/0MsdMwbwKBgQDBKmRO+Dc+l2KmJC7PoMiAODKfmCjMtzgvWr/u6ubTvveCWycs
/r1eh68kYU5ud2F2CDYQA4WNPKZujki0PciP5inc22ymdBdT+ejaEIVzFPKSSxZ/
ZM2vU9r0yAopa7A7VoTMw+MhGB6qSQUu/Mwss+89T0V86yqCnJ0+iyop2QKBgEKW
0+dyzc3e2My7XPEXAfFVJVDVx1+6ZJz9HpTctUYk83U2Fx7TMmZPIROQqLEKjqtd
ncXZIgxH9nJ6AZJku0mV5sbfATB8imeYsVy2a6XmywrV50eOzxPzMCsWNKPskrIJd
3s42Wh0LGmhXhpKwvinyfSiFD1E7SaVdp9jTHsdvAoGBAJ2RrwLcrJCLSHg5OLRE
/XxadhtmhrzTZZgA6X50Y5ZMzgmhU1A3qEC0EYdJpotKqFy8ZZqTkJVx4Bc29wVr
KzgP7x2extfeQMwa4NRzUClVGBQVFE/hy3nWWYTg6aOs7rfiulprz9X0WUUDpcR2
ncRc6tE8Nxcm/tzOt2TraLd/e
-----END PRIVATE KEY-----`;

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
