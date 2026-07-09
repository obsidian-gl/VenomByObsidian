/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './api/_firebase-admin';
import webPush from 'web-push';

let vapidKeys: { publicKey: string; privateKey: string } | null = null;

async function getVapidKeys() {
  if (vapidKeys) return vapidKeys;
  if (!db) {
    const keys = webPush.generateVAPIDKeys();
    vapidKeys = keys;
    return keys;
  }
  
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
  } catch (err) {
    console.error('Error fetching/generating VAPID keys in server.ts:', err);
    const generated = webPush.generateVAPIDKeys();
    webPush.setVapidDetails(
      'mailto:work.tilakpopatfilms@gmail.com',
      generated.publicKey,
      generated.privateKey
    );
    return generated;
  }
}

async function getPostByHash(hash: string) {
  if (!db) return null;
  try {
    const querySnapshot = await db.collection('posts').where('encryptedHash', '==', hash).limit(1).get();
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
  } catch (err) {
    console.error('Error fetching post by hash in server.ts:', err);
  }
  return null;
}

function generateOgMetaTags(post: any, host: string, hashId: string) {
  const title = `Venom — "${post.title}"`;
  const description = post.content 
    ? post.content.substring(0, 160) + (post.content.length > 160 ? '...' : '')
    : 'Access declassified anonymous dispatch via Venom decentralized network.';
  
  // Directly point to the actual post image if it is an external URL to avoid redirects which some social crawlers block,
  // or fall back directly to the green Venom favicon when no post image exists.
  let imageUrl = 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png';
  if (post.imageUrl) {
    if (post.imageUrl.startsWith('data:')) {
      imageUrl = `https://${host}/api/post-image/${hashId}`;
    } else if (post.imageUrl.startsWith('http://') || post.imageUrl.startsWith('https://')) {
      imageUrl = post.imageUrl;
    }
  }

  const shareUrl = `https://${host}/?id=${hashId}`;

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${shareUrl}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${imageUrl}" />
  `;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support JSON payloads for web push subscriptions
  app.use(express.json());

  // Set up Vite server instance outside for use in the dynamic index.html interceptor
  let vite: any = null;
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get IP endpoint to resolve real device public IP behind proxies
  app.all('/api/get-ip', (req, res) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    let ip = '';
    if (typeof xForwardedFor === 'string') {
      ip = xForwardedFor.split(',')[0].trim();
    } else if (Array.isArray(xForwardedFor)) {
      ip = xForwardedFor[0].trim();
    } else {
      ip = req.socket.remoteAddress || '';
    }
    // Convert IPv6 loopback to readable local IP
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      ip = '127.0.0.1';
    }
    res.json({ ip });
  });

  // Get active VAPID public key
  app.all('/api/push-vapid-key', async (req, res) => {
    try {
      const keys = await getVapidKeys();
      res.json({ publicKey: keys.publicKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save/Register push subscription
  app.post('/api/push-subscribe', async (req, res) => {
    const { subscription, browser, device, deviceImei } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Subscription data with endpoint is required.' });
    }

    try {
      // Use URL-safe Base64 representation of endpoint as document ID
      const endpointHash = Buffer.from(subscription.endpoint).toString('base64url');
      const subDocRef = db.doc(`pushSubscriptions/${endpointHash}`);

      await subDocRef.set({
        endpoint: subscription.endpoint,
        keys: subscription.keys || {},
        browser: browser || 'Unknown',
        device: device || 'Unknown',
        deviceImei: deviceImei || 'WEB-USER',
        subscription: subscription,
        createdAt: new Date().toISOString()
      });

      res.status(201).json({ success: true, message: 'Subscription successfully registered.' });
    } catch (err: any) {
      console.error('Failed to save push subscription in server.ts:', err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // Remove/Unsubscribe push subscription
  app.post('/api/push-unsubscribe', async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Subscription endpoint is required.' });
    }

    try {
      const endpointHash = Buffer.from(endpoint).toString('base64url');
      const subDocRef = db.doc(`pushSubscriptions/${endpointHash}`);
      await subDocRef.delete();
      res.json({ success: true, message: 'Subscription successfully removed.' });
    } catch (err: any) {
      console.error('Failed to unsubscribe in server.ts:', err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // Broadcast push notifications to all registered devices (Legacy helper)
  app.post('/api/push-send', async (req, res) => {
    const { title, body, url } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required.' });
    }

    try {
      await getVapidKeys();
      const subCollectionRef = db.collection('pushSubscriptions');
      const subSnap = await subCollectionRef.get();

      if (subSnap.empty) {
        return res.json({ success: true, sentCount: 0, message: 'No devices have registered for push notifications.' });
      }

      const payload = JSON.stringify({
        title,
        body,
        url: url || '/',
        icon: 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
        badge: 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png',
        image: '',
        timestamp: Date.now()
      });

      let successCount = 0;
      let failureCount = 0;

      const promises = subSnap.docs.map(async (subDoc: any) => {
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
            console.error(`Failed to send notification to doc ${subDoc.id} in server.ts:`, err.message);
            failureCount++;
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db.doc(`pushSubscriptions/${subDoc.id}`).delete().catch((delErr) => {
                console.error(`Failed to delete obsolete subscription ${subDoc.id} in server.ts:`, delErr);
              });
            }
          }
        }
      });

      await Promise.all(promises);

      res.json({
        success: true,
        sentCount: successCount,
        failedCount: failureCount,
        message: `Successfully broadcasted to ${successCount} devices, pruned ${failureCount} obsolete registration(s).`
      });
    } catch (err: any) {
      console.error('Failed to broadcast push notification in server.ts:', err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // Broadcast push notifications to all registered devices (Standard payload with Icon, Badge, Image, URL)
  app.post('/api/send-notification', async (req, res) => {
    const { title, message, body: alternativeBody, icon, badge, image, url } = req.body;
    const messageContent = message || alternativeBody;

    if (!title || !messageContent) {
      return res.status(400).json({ error: 'Title and message/body are required.' });
    }

    try {
      await getVapidKeys();
      const subCollectionRef = db.collection('pushSubscriptions');
      const subSnap = await subCollectionRef.get();

      if (subSnap.empty) {
        return res.json({
          success: true,
          sentCount: 0,
          failedCount: 0,
          message: 'No active devices have registered for push notifications.'
        });
      }

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

      const promises = subSnap.docs.map(async (subDoc: any) => {
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
            console.error(`Failed to send notification to doc ${subDoc.id} in server.ts:`, err.message);
            failureCount++;
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db.doc(`pushSubscriptions/${subDoc.id}`).delete().catch((delErr) => {
                console.error(`Failed to delete obsolete subscription doc ${subDoc.id} in server.ts:`, delErr);
              });
            }
          }
        }
      });

      await Promise.all(promises);

      res.json({
        success: true,
        sentCount: successCount,
        failedCount: failureCount,
        message: `Delivered message to ${successCount} active receiver(s) successfully. Pruned ${failureCount} defunct registration(s).`
      });
    } catch (err: any) {
      console.error('Failed to broadcast push notification in server.ts:', err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // Redirect root favicon requests to the custom favicon to guarantee tab display
  app.get(['/favicon.ico', '/favicon.png'], (req, res) => {
    res.redirect('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
  });

  // Serve the post's dynamic image for social media crawler preview (handles base64 data URIs perfectly)
  app.get('/api/post-image/:hash', async (req, res) => {
    const hash = req.params.hash;
    if (!hash) {
      return res.redirect('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
    }

    try {
      const post = await getPostByHash(hash);
      if (post && post.imageUrl) {
        if (post.imageUrl.startsWith('data:')) {
          const match = post.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const contentType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            return res.send(buffer);
          }
        }
        return res.redirect(post.imageUrl);
      }
    } catch (err) {
      console.error('Error serving post image:', err);
    }
    res.redirect('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
  });

  // Intercept root GET requests with a share query (?id=HASH) for dynamic OG tag injection
  app.get('/', async (req, res, next) => {
    const hashId = req.query.id;
    if (typeof hashId !== 'string') {
      return next(); // Pass to static/Vite handler if no share query
    }

    try {
      const post = await getPostByHash(hashId);
      if (!post) {
        return next();
      }

      const ogTags = generateOgMetaTags(post, req.headers.host || 'localhost:3000', hashId);

      if (process.env.NODE_ENV !== 'production' && vite) {
        const rawHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const viteHtml = await vite.transformIndexHtml(req.originalUrl || req.url, rawHtml);
        let modifiedHtml = viteHtml.replace(/<title>[^<]+<\/title>/g, '');
        modifiedHtml = modifiedHtml.replace('<head>', `<head>${ogTags}`);
        return res.setHeader('Content-Type', 'text/html').send(modifiedHtml);
      } else {
        const prodHtml = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8');
        let modifiedHtml = prodHtml.replace(/<title>[^<]+<\/title>/g, '');
        modifiedHtml = modifiedHtml.replace('<head>', `<head>${ogTags}`);
        return res.setHeader('Content-Type', 'text/html').send(modifiedHtml);
      }
    } catch (err) {
      console.error('Error in dynamic OG index route:', err);
      return next();
    }
  });

  // Handle static assets and SPA fallback
  if (process.env.NODE_ENV !== 'production') {
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve production static assets
    app.use(express.static(distPath));
    
    // Redirect all other requests back to index.html to allow client-side router
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
