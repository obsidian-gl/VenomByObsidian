/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IncomingMessage, ServerResponse } from 'http';
import { getVapidKeys } from './_vapid';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    });

    if (req.method === 'OPTIONS') {
      res.end();
      return;
    }

    const keys = await getVapidKeys();
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
