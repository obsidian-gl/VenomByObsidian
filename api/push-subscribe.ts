import { IncomingMessage, ServerResponse } from 'http';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../src/firebase.js';

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
    const { subscription, browser, device, deviceImei } = body;

    if (!subscription || !subscription.endpoint) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Subscription data with endpoint is required.' }));
      return;
    }

    if (!db) {
      throw new Error('Database connection is not initialized.');
    }

    // Hash endpoint to create a unique alphanumeric document ID
    const endpointHash = Buffer.from(subscription.endpoint).toString('base64url');
    const subDocRef = doc(db, 'pushSubscriptions', endpointHash);

    // Save complete structure exactly as required
    await setDoc(subDocRef, {
      endpoint: subscription.endpoint,
      keys: subscription.keys || {},
      browser: browser || 'Unknown',
      device: device || 'Unknown',
      deviceImei: deviceImei || 'WEB-USER',
      subscription: subscription, // Keep full copy for direct web-push SDK usage
      createdAt: new Date().toISOString()
    });

    res.end(JSON.stringify({ success: true, message: 'Subscription registered successfully.' }));
  } catch (err: any) {
    console.error('Failed to register subscription on Vercel backend:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Database transaction failed.' }));
  }
}
