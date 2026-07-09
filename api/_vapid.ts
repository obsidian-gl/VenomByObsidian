import webPush from 'web-push';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../src/firebase.js';

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys() {
  if (vapidKeys) return vapidKeys;
  if (!db) {
    const keys = webPush.generateVAPIDKeys();
    vapidKeys = keys;
    return keys;
  }
  
  try {
    const keyDocRef = doc(db, 'system', 'vapidKeys');
    const keyDoc = await getDoc(keyDocRef);
    if (keyDoc.exists()) {
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
    
    const generated = webPush.generateVAPIDKeys();
    await setDoc(keyDocRef, {
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
  } catch (err) {
    console.error('Error fetching/generating VAPID keys, using dynamic fallback:', err);
    const generated = webPush.generateVAPIDKeys();
    webPush.setVapidDetails(
      'mailto:work.tilakpopatfilms@gmail.com',
      generated.publicKey,
      generated.privateKey
    );
    return generated;
  }
}
