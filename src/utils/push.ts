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

export function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("SamsungBrowser")) return "Samsung Browser";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  if (ua.includes("Trident")) return "Internet Explorer";
  if (ua.includes("Edge") || ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Unknown Browser";
}

export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "Tablet";
  if (/Mobile|Android|iP(hone|od)/i.test(ua)) return "Mobile";
  return "Desktop";
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushSubscriptionState(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!await isPushSupported()) return 'unsupported';
  
  const permission = Notification.permission;
  if (permission === 'granted') {
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

    // Safe cross-origin iframe check
    let isIframe = false;
    try {
      isIframe = typeof window !== 'undefined' && window.self !== window.top;
    } catch (e) {
      isIframe = true;
    }

    if (isIframe) {
      return { 
        success: false, 
        error: 'Authorization sandbox block. Please click the "Open in New Tab" button to establish a secure link outside the iframe container.' 
      };
    }

    // 1. Request Browser Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permissions were denied by the browser.' };
    }

    // 2. Register or retrieve active Service Worker
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    
    // Ensure the service worker is active and updated
    await registration.update().catch(() => {});
    const activeRegistration = await navigator.serviceWorker.ready;

    // 3. Fetch VAPID Public Key from Server
    const response = await fetch(`/api/push-vapid-key?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Connection failed with code: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Sandbox cookie check intercepted the request. Please reload the standalone tab and try again.');
    }

    const { publicKey } = await response.json();
    if (!publicKey) {
      throw new Error('Server returned empty push key.');
    }

    // 4. Subscribe with Push Manager
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await activeRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // Get browser and device info
    const browser = getBrowserInfo();
    const device = getDeviceInfo();

    // 5. Send Subscription details to Server
    const saveResponse = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        browser,
        device,
        deviceImei: localStorage.getItem('venom_device_imei') || 'WEB-USER',
      }),
    });

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to register subscription details with security server.');
    }

    return { success: true };
  } catch (err: any) {
    console.error('Push Subscription Setup Failed:', err);
    return { success: false, error: err.message || 'Unknown secure channel protocol error.' };
  }
}

export async function unsubscribeUserFromPush(): Promise<boolean> {
  try {
    if (!await isPushSupported()) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      
      // Notify backend to remove from Firestore
      await fetch('/api/push-unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      }).catch(err => console.warn('Failed to unsubscribe on backend:', err));
      
      return true;
    }
    return false;
  } catch (err) {
    console.error('Push Unsubscription Failed:', err);
    return false;
  }
}
