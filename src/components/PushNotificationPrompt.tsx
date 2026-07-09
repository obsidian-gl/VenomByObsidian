/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, Loader2, AlertCircle, ExternalLink, Settings } from 'lucide-react';
import { getPushSubscriptionState, subscribeUserToPush } from '../utils/push';

export const PushNotificationPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isIframe = (() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch (e) {
      return true; // Security error guarantees we are in a cross-origin iframe
    }
  })();

  const isAiStudioPreview = (() => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return (
      hostname.includes('ais-dev-') ||
      hostname.includes('ais-pre-') ||
      hostname.includes('asia-southeast1.run.app') ||
      hostname.includes('run.app') ||
      hostname.includes('aistudio')
    );
  })();

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  useEffect(() => {
    // Check if the user is already subscribed or if notifications are blocked
    const checkStatus = async () => {
      try {
        const state = await getPushSubscriptionState();
        // If state is prompt or denied, show the prompt to the user
        if (state === 'prompt' || state === 'denied') {
          // Delay display slightly for a calmer user experience (1.5 seconds)
          const timer = setTimeout(() => {
            const hasDismissed = sessionStorage.getItem('venom_push_dismissed');
            if (!hasDismissed) {
              setIsVisible(true);
            }
          }, 1500);
          return () => clearTimeout(timer);
        }
      } catch (e) {
        console.warn('Error checking push subscription status:', e);
      }
    };
    checkStatus();
  }, []);

  const handleSubscribe = async () => {
    setStatus('loading');
    setErrorMessage('');
    
    try {
      // Check permission state first
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
        setStatus('error');
        setErrorMessage('blocked');
        return;
      }

      const result = await subscribeUserToPush();
      if (result.success) {
        setStatus('success');
        setTimeout(() => {
          setIsVisible(false);
        }, 2000);
      } else {
        setStatus('error');
        if (result.error?.includes('denied') || result.error?.includes('permission')) {
          setErrorMessage('blocked');
        } else {
          setErrorMessage(result.error || 'Permission denied or network failed.');
        }
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Verification protocol failed.');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Keep dismissed state in sessionStorage so we don't spam them in the current visit,
    // but on next load (revisit) it will ask again!
    sessionStorage.setItem('venom_push_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-[380px] z-[999] bg-zinc-950 border border-emerald-500/20 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] font-mono text-zinc-300"
          id="push-prompt-container"
        >
          {/* Accent Line */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />
          
          <div className="p-4 relative">
            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 p-1 rounded bg-zinc-900/60 border border-zinc-850 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 transition-colors cursor-pointer"
              title="Dismiss prompt"
              id="push-dismiss-btn"
            >
              <X className="w-3.5 h-3.5" />
            </button>

             {status === 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-emerald-950/20 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                    <Bell className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block leading-none">
                      {isAiStudioPreview ? 'Preview Environment' : isIframe ? 'Iframe Sandbox Mode' : 'Dispatch Receiver'}
                    </span>
                    <h4 className="text-xs font-black text-zinc-100 uppercase tracking-wider mt-1">
                      {isAiStudioPreview ? 'Push Notifications Suspended' : isIframe ? 'Open Standalone Tab' : 'Stay Live & Standby'}
                    </h4>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed font-sans text-zinc-400">
                  {isAiStudioPreview ? (
                    'Push Notifications cannot work inside AI Studio Preview. Browser sandbox layers and proxy authentication gates prevent external subscription handshakes. Please test from your deployed production HTTPS website.'
                  ) : isIframe ? (
                    'Browser sandbox policies prevent service worker registration and push key authorizations inside preview frames. Open this app in a standalone browser tab to safely enable real-time notifications.'
                  ) : (
                    'Enable secure push notifications to receive real-time dispatches, group community activity, and network notifications even when browser tabs are closed.'
                  )}
                </p>

                <div className="flex gap-2 pt-1">
                  {isAiStudioPreview ? (
                    <button
                      onClick={handleDismiss}
                      className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[10px] font-black uppercase tracking-wider rounded transition-colors cursor-pointer"
                      id="push-dismiss-action-btn"
                    >
                      Acknowledge
                    </button>
                  ) : isIframe ? (
                    <button
                      onClick={handleOpenNewTab}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[10px] font-black uppercase tracking-wider rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30"
                      id="push-open-tab-btn"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in New Tab</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSubscribe}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-[10px] font-black uppercase tracking-wider rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30"
                      id="push-allow-btn"
                    >
                      <span>Enable Notifications</span>
                    </button>
                  )}
                  <button
                    onClick={handleDismiss}
                    className="px-3.5 py-2 border border-zinc-850 hover:border-zinc-750 text-zinc-400 hover:text-zinc-200 text-[10px] font-black uppercase tracking-wider rounded transition-colors cursor-pointer"
                    id="push-not-now-btn"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            )}

            {status === 'loading' && (
              <div className="py-6 flex flex-col items-center justify-center space-y-3 text-center">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <div>
                  <h4 className="text-xs font-black text-zinc-100 uppercase tracking-wider">
                    Establishing Secure Link
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                    Registering device client with Venom Core...
                  </p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="py-6 flex flex-col items-center justify-center space-y-3 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                    Receiver Online
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                    Push encryption keys registered successfully.
                  </p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    Connection Protocol Failed
                  </h4>
                </div>
                
                {errorMessage === 'blocked' ? (
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                      Notification permissions are currently **denied/blocked** by your browser settings. To receive secure Venom dispatches, please click the site settings icon (lock/options) in your address bar and change Notifications permission to **Allow**.
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 uppercase bg-zinc-900/50 p-2 rounded border border-zinc-900">
                      <Settings className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>Configure: Site Settings &rarr; Notifications &rarr; Allow</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                    {errorMessage || 'Your browser blocks notification permissions or is running inside an isolated sandbox. Please check browser permissions.'}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSubscribe}
                    className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-[9px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                  >
                    Retry Protocol
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3.5 py-1.5 border border-zinc-850 text-zinc-500 hover:text-zinc-400 text-[9px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
