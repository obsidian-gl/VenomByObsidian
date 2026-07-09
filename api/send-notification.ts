/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from 'http';
import { db } from './_firebase-admin.js';
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
  // Set CORS headers safely
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed. Use POST instead.' }));
    return;
  }

  try {
    const startTime = Date.now();
    const body = await getRequestBody(req);
    const { title, message, body: alternativeBody, icon, badge, image, url, targetEndpoint } = body;

    const messageContent = message || alternativeBody;

    if (!title || !messageContent) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Title and Message are required fields.' }));
      return;
    }

    if (!db) {
      throw new Error('Firebase Admin Firestore database is not initialized.');
    }

    // Ensure VAPID keys are retrieved and set up
    await getVapidKeys();

    const subCollectionRef = db.collection('pushSubscriptions');
    const subSnap = await subCollectionRef.get();

    if (subSnap.empty) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        sentCount: 0,
        failedCount: 0,
        executionTimeMs: Date.now() - startTime,
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
      actions: body.actions || [],
      timestamp: Date.now()
    });

    let successCount = 0;
    let failureCount = 0;

    const promises = subSnap.docs.map(async (subDoc: any) => {
      const subData = subDoc.data();
      const subscription = subData.subscription || {
        endpoint: subData.endpoint,
        keys: {
          p256dh: subData.p256dh,
          auth: subData.auth
        }
      };

      if (subscription && subscription.endpoint) {
        // If targetEndpoint is specified, filter to only send to that specific subscriber
        if (targetEndpoint && subscription.endpoint !== targetEndpoint) {
          return;
        }

        try {
          await webPush.sendNotification(subscription, payload);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to dispatch web-push to subscriber ${subDoc.id}:`, err.message);
          failureCount++;
          // Prune / clean up expired or defunct subscriptions immediately (HTTP status 410 Gone or 404 Not Found)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.doc(`pushSubscriptions/${subDoc.id}`).delete().catch((delErr: any) => {
              console.error(`Failed to auto-prune subscription doc ${subDoc.id}:`, delErr);
            });
          }
        }
      }
    });

    await Promise.all(promises);

    const executionTimeMs = Date.now() - startTime;

    // Save notification history log to Firestore (skip logs for targeted test notifications)
    if (!targetEndpoint) {
      await db.collection('notificationHistory').add({
        title,
        message: messageContent,
        icon: icon || 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
        badge: badge || 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
        image: image || '',
        url: url || '/',
        actions: body.actions || [],
        sentCount: successCount,
        failedCount: failureCount,
        executionTimeMs,
        sentAt: new Date().toISOString()
      }).catch((histErr: any) => {
        console.error('Failed to log notification history to Firestore:', histErr);
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      sentCount: successCount,
      failedCount: failureCount,
      executionTimeMs,
      message: targetEndpoint
        ? 'Test dispatch delivered to target browser.'
        : `Delivered message to ${successCount} active receiver(s) successfully. Pruned ${failureCount} defunct registration(s).`
    }));
  } catch (err: any) {
    console.error('API /api/send-notification failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: err.message || 'Notification broadcast protocol crashed.',
      stack: err.stack
    }));
  }
}
