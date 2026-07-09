/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import webPush from 'web-push';

let vapidKeys: { publicKey: string; privateKey: string; subject: string } | null = null;

export async function getVapidKeys() {
  if (vapidKeys) return vapidKeys;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:work.tilakpopatfilms@gmail.com';

  if (publicKey && privateKey) {
    vapidKeys = { publicKey, privateKey, subject };
    webPush.setVapidDetails(subject, publicKey, privateKey);
    return vapidKeys;
  }

  // Fallback to dynamic key generation to prevent serverless function failure
  console.warn('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY environment variable is not configured. Generating on the fly.');
  const generated = webPush.generateVAPIDKeys();
  vapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject
  };
  webPush.setVapidDetails(subject, generated.publicKey, generated.privateKey);
  return vapidKeys;
}
