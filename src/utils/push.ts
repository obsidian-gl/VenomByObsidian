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

    // Fast-fail if running inside the iframe preview sandbox
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      return { 
        success: false, 
        error: 'Authorization sandbox block. Please click the "Open in New Tab" button to configure secure notification dispatches.' 
      };
    }

    // 1. Request Browser Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' };
    }

    // 2. Register or retrieve active Service Worker
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await registration.update().catch(() => {});
    const activeRegistration = await navigator.serviceWorker.ready;

    // 3. Fetch VAPID Public Key from Server with self-healing GET/POST and cleanup fallbacks
    let publicKey = '';
    let fetchError: any = null;

    // Try Method A: POST request (fully bypasses Service Worker fetch interception)
    try {
      const response = await fetch(`/api/push-vapid-key?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (response.ok && !response.redirected) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data && data.publicKey) {
            publicKey = data.publicKey;
          }
        }
      }
    } catch (err) {
      console.warn('POST method for key fetch failed, attempting GET fallback...', err);
    }

    // Try Method B: GET request (if POST failed or was unsupported)
    if (!publicKey) {
      try {
        const response = await fetch(`/api/push-vapid-key?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok && !response.redirected) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            if (data && data.publicKey) {
              publicKey = data.publicKey;
            }
          }
        }
      } catch (err) {
        fetchError = err;
      }
    }

    // Try Method C: Active Force Cleanup & Re-fetch (if both GET and POST returned HTML or failed)
    if (!publicKey) {
      console.warn('Network key fetch returned invalid formats or was intercepted. Initiating silent cache purge...');
      
      // Silently clean up Service Worker registrations and caches
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        if ('caches' in window) {
          const cacheKeys = await window.caches.keys();
          for (const key of cacheKeys) {
            await window.caches.delete(key);
          }
        }
      } catch (cleanErr) {
        console.warn('Silent cache purge failed:', cleanErr);
      }

      // Re-register a fresh Service Worker instance
      const freshReg = await navigator.serviceWorker.register('/sw.js');
      await freshReg.update().catch(() => {});
      const freshActiveReg = await navigator.serviceWorker.ready;

      // Final Attempt via POST (immune to SW cache)
      const finalResponse = await fetch(`/api/push-vapid-key?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!finalResponse.ok) {
        throw new Error(`Connection failed with code: ${finalResponse.status}`);
      }

      const finalContentType = finalResponse.headers.get('content-type');
      if (!finalContentType || !finalContentType.includes('application/json')) {
        throw new Error('Server returned unexpected document format. Please try accessing the app directly in a fresh tab.');
      }

      const finalData = await finalResponse.json();
      if (!finalData || !finalData.publicKey) {
        throw new Error('Key handshake returned an empty response.');
      }
      publicKey = finalData.publicKey;
    }

    // 4. Subscribe with Push Manager
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await activeRegistration.pushManager.subscribe({
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
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (err) {
    console.error('Push Unsubscription Failed:', err);
    return false;
  }
}
