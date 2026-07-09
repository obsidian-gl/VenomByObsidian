/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import webPush from 'web-push';
import { db } from './_firebase-admin';

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys() {
  if (vapidKeys) return vapidKeys;
  
  try {
    const keyDocRef = db.doc('system/vapidKeys');
    const keyDoc = await keyDocRef.get();
    
    if (keyDoc.exists) {
      const data = keyDoc.data();
      if (data && data.publicKey && data.privateKey) {
        vapidKeys = {
          publicKey: data.publicKey,
          privateKey: data.privateKey
        };
        webPush.setVapidDetails(
          'mailto:work.tilakpopatfilms@gmail.com',
          vapidKeys.publicKey,
          vapidKeys.privateKey
        );
        return vapidKeys;
      }
    }
    
    // Generate fresh VAPID keys if they don't exist
    const generated = webPush.generateVAPIDKeys();
    await keyDocRef.set({
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      updatedAt: new Date().toISOString()
    });
    
    vapidKeys = generated;
    webPush.setVapidDetails(
      'mailto:work.tilakpopatfilms@gmail.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    return vapidKeys;
  } catch (err: any) {
    console.error('Error fetching or generating VAPID keys from Admin Firestore:', err);
    // Dynamic fallback key generation to prevent crashing the serverless container
    const generated = webPush.generateVAPIDKeys();
    webPush.setVapidDetails(
      'mailto:work.tilakpopatfilms@gmail.com',
      generated.publicKey,
      generated.privateKey
    );
    return generated;
  }
}
