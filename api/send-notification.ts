import { IncomingMessage, ServerResponse } from 'http';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../src/firebase.js';
import webPush from 'web-push';
import { getVapidKeys } from './_vapid.js';

async function getRequestBody(req: any): Promise<any> {
  if (req.body) return req.body;
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Set CORS headers
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  });

  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST instead.' }));
    return;
  }

  try {
    const body = await getRequestBody(req);
    const { title, message, body: alternativeBody, icon, badge, image, url } = body;

    const messageContent = message || alternativeBody;

    if (!title || !messageContent) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Title and Message are required fields.' }));
      return;
    }

    if (!db) {
      throw new Error('Database connection is not initialized.');
    }

    // Ensure VAPID keys are retrieved and set up
    await getVapidKeys();

    const subCollectionRef = collection(db, 'pushSubscriptions');
    const subSnap = await getDocs(subCollectionRef);

    if (subSnap.empty) {
      res.end(JSON.stringify({
        success: true,
        sentCount: 0,
        failedCount: 0,
        message: 'No active devices have registered for push notifications.'
      }));
      return;
    }

    // Construct the notification payload exactly per specifications
    const payload = JSON.stringify({
      title,
      body: messageContent,
      icon: icon || 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
      badge: badge || 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
      image: image || '',
      url: url || '/',
      timestamp: Date.now()
    });

    let successCount = 0;
    let failureCount = 0;

    const promises = subSnap.docs.map(async (subDoc) => {
      const subData = subDoc.data();
      const subscription = subData.subscription || {
        endpoint: subData.endpoint,
        keys: subData.keys || {}
      };

      if (subscription && subscription.endpoint) {
        try {
          await webPush.sendNotification(subscription, payload);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to dispatch web-push to subscriber ${subDoc.id}:`, err.message);
          failureCount++;
          // Prune / clean up expired or defunct subscriptions immediately (HTTP status 410 Gone or 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await deleteDoc(doc(db, 'pushSubscriptions', subDoc.id)).catch(() => {});
          }
        }
      }
    });

    await Promise.all(promises);

    res.end(JSON.stringify({
      success: true,
      sentCount: successCount,
      failedCount: failureCount,
      message: `Delivered message to ${successCount} active receiver(s) successfully. Pruned ${failureCount} defunct registration(s).`
    }));
  } catch (err: any) {
    console.error('Failed to run notification broadcast transaction:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Notification broadcast protocol crashed.' }));
  }
}
