/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from 'http';
import { db } from './_firebase-admin.js';

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
    const body = await getRequestBody(req);
    const { subscription, browser, device, deviceImei } = body;

    if (!subscription || !subscription.endpoint) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Subscription data with endpoint is required.' }));
      return;
    }

    if (!db) {
      throw new Error('Firebase Admin Firestore database is not initialized.');
    }

    // Hash endpoint to create a unique alphanumeric document ID
    const endpointHash = Buffer.from(subscription.endpoint).toString('base64url');
    const subDocRef = db.doc(`pushSubscriptions/${endpointHash}`);

    // Save complete structure exactly as required per production audit specifications
    const keys = subscription.keys || {};
    const p256dh = keys.p256dh || '';
    const auth = keys.auth || '';
    const now = new Date().toISOString();

    await subDocRef.set({
      endpoint: subscription.endpoint,
      p256dh: p256dh,
      auth: auth,
      browser: browser || 'Unknown',
      device: device || 'Unknown',
      deviceImei: deviceImei || 'WEB-USER',
      subscription: subscription, // Keep full copy for direct web-push SDK usage
      createdAt: now,
      updatedAt: now,
      status: 'active'
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Subscription registered successfully.' }));
  } catch (err: any) {
    console.error('API /api/push-subscribe failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: err.message || 'Database transaction failed.',
      stack: err.stack
    }));
  }
}
