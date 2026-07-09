/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from 'http';
import { getVapidKeys } from './_vapid.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Set CORS and caching headers safely
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end();
    return;
  }

  try {
    const keys = await getVapidKeys();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ publicKey: keys.publicKey }));
  } catch (err: any) {
    console.error('API /api/push-vapid-key failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: err.message || 'Server-side key generation failed.',
      stack: err.stack 
    }));
  }
}
