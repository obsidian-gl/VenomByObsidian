/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushSubscriptionState(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!await isPushSupported()) return 'unsupported';
  
  const permission = Notification.permission;
  if (permission === 'granted') {
    // Check if there is an active subscription
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'granted' : 'prompt';
  }
  if (permission === 'default') {
    return 'prompt';
  }
  return 'denied';
}

export async function subscribeUserToPush(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!await isPushSupported()) {
      return { success: false, error: 'Push notifications are not supported by this browser.' };
    }

    // 1. Request Browser Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' };
    }

    // 2. Fetch VAPID Public Key from Server
    const response = await fetch('/api/push-vapid-key');
    if (!response.ok) {
      throw new Error(`Failed to retrieve network security keys: ${response.statusText}`);
    }
    const { publicKey } = await response.json();
    if (!publicKey) {
      throw new Error('Server returned empty security key.');
    }

    // 3. Register or get Service Worker
    const registration = await navigator.serviceWorker.ready;

    // 4. Subscribe with Push Manager
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // 5. Send Subscription details to Express Server
    const saveResponse = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        deviceImei: localStorage.getItem('venom_device_imei') || 'WEB-USER',
      }),
    });

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json();
      throw new Error(errorData.error || 'Failed to save subscription on server.');
    }

    return { success: true };
  } catch (err: any) {
    console.error('Push Subscription Setup Failed:', err);
    return { success: false, error: err.message || 'Unknown network error.' };
  }
}

export async function unsubscribeUserFromPush(): Promise<boolean> {
  try {
    if (!await isPushSupported()) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (err) {
    console.error('Push Unsubscription Failed:', err);
    return false;
  }
}
