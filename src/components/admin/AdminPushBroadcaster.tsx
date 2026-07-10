/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Eye, 
  History, 
  Terminal, 
  Bell, 
  Settings, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { db, notificationsDb } from '../../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { getBrowserInfo, getDeviceInfo } from '../../utils/push';

export const AdminPushBroadcaster: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'broadcast' | 'history' | 'diagnostics'>('broadcast');

  // Broadcast form fields
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [icon, setIcon] = useState('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
  const [badge, setBadge] = useState('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
  const [image, setImage] = useState('');
  const [url, setUrl] = useState('/');

  // Broadcast execution stats
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [stats, setStats] = useState<{ 
    sentCount: number; 
    failedCount: number; 
    executionTimeMs: number;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Past notifications history state
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Diagnostic self-test console logs
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Mock phone preview toggle
  const [showPreview, setShowPreview] = useState(true);

  // AI Studio Preview Mode Detection helper
  const isAiStudioPreview = () => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return (
      hostname.includes('ais-dev-') ||
      hostname.includes('ais-pre-') ||
      hostname.includes('asia-southeast1.run.app') ||
      hostname.includes('run.app') ||
      hostname.includes('aistudio')
    );
  };

  const addDiagnosticLog = (msg: string) => {
    setDiagnosticLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Fetch past transmissions history
  const loadHistory = async () => {
    if (!notificationsDb) return;
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(notificationsDb, 'notificationHistory'),
        orderBy('sentAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHistoryLogs(items);
    } catch (err: any) {
      console.error('Failed to retrieve notification logs:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle active tab change
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  // Handle emergency alert broadcast
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setStatus('sending');
    setErrorMsg('');
    setStats(null);

    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          message: body,
          icon,
          badge,
          image,
          url,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setStatus('success');
        setStats({
          sentCount: data.sentCount || 0,
          failedCount: data.failedCount || 0,
          executionTimeMs: data.executionTimeMs || 0,
          message: data.message || 'Transmission dispatched successfully.',
        });
        // Prune dynamic inputs but retain core brand icons
        setTitle('');
        setBody('');
        setImage('');
        setUrl('/');
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Server rejected broadcast command payload.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Decentralized network connection protocol failure.');
    }
  };

  // Run Self-Test & Detailed Diagnostics Loop (Test Notification)
  const handleSelfTest = async () => {
    setActiveTab('diagnostics');
    setIsTesting(true);
    setDiagnosticLogs([]);
    addDiagnosticLog('Initializing secure diagnostic loop...');

    try {
      // 1. Compatibility
      addDiagnosticLog('Checking browser push capability matrix...');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('This browser lacks standard web push notification capability layers.');
      }
      addDiagnosticLog('Browser capability verified (ServiceWorker, PushManager, Notification present).');

      // 2. Permission
      addDiagnosticLog('Diagnosing active user permission state...');
      const permission = Notification.permission;
      addDiagnosticLog(`Current notification authorization state: "${permission}"`);
      
      if (permission === 'denied') {
        throw new Error('Notification permissions are blocked. Reset browser site settings to allow testing.');
      }

      if (permission === 'default') {
        addDiagnosticLog('Requesting browser permissions via system dialog...');
        const choice = await Notification.requestPermission();
        addDiagnosticLog(`User permission interaction result: "${choice}"`);
        if (choice !== 'granted') {
          throw new Error('Notification permissions denied or dismissed.');
        }
      }

      // 3. Service Worker Handshake
      addDiagnosticLog('Resolving service worker registration at /sw.js...');
      let registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (!registration) {
        addDiagnosticLog('Service Worker not registered. Launching background installation...');
        registration = await navigator.serviceWorker.register('/sw.js');
      }
      addDiagnosticLog('Updating service worker script to verify active cache revisions...');
      await registration.update().catch(() => {});
      addDiagnosticLog('Awaiting navigator.serviceWorker.ready callback...');
      const activeWorker = await navigator.serviceWorker.ready;
      addDiagnosticLog('Service worker ready. Navigation matching channel established.');

      // 4. Retrieve public VAPID key
      addDiagnosticLog('Querying server for active cryptographic VAPID public key...');
      const keyResponse = await fetch(`/api/push-vapid-key?t=${Date.now()}`);
      if (!keyResponse.ok) {
        throw new Error(`Key exchange API returned status code ${keyResponse.status}`);
      }
      
      const { publicKey } = await keyResponse.json();
      if (!publicKey) {
        throw new Error('Server returned empty VAPID key.');
      }
      addDiagnosticLog(`VAPID public credentials retrieved: "${publicKey.substring(0, 15)}..."`);

      // 5. Build Push Subscription
      addDiagnosticLog('Converting VAPID public key to standard Uint8Array...');
      const paddingStr = '='.repeat((4 - publicKey.length % 4) % 4);
      const base64Str = (publicKey + paddingStr).replace(/-/g, '+').replace(/_/g, '/');
      const rawBinary = window.atob(base64Str);
      const binaryBuffer = new Uint8Array(rawBinary.length);
      for (let i = 0; i < rawBinary.length; i++) {
        binaryBuffer[i] = rawBinary.charCodeAt(i);
      }

      addDiagnosticLog('Awaiting subscription from PushManager...');
      const subscription = await activeWorker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: binaryBuffer
      });
      addDiagnosticLog('Browser push subscription successfully registered.');

      // 6. Sync with server database
      addDiagnosticLog('Synchronizing push subscription credentials with Firestore DB...');
      const browserInfo = getBrowserInfo();
      const deviceInfo = getDeviceInfo();
      const syncResponse = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          browser: browserInfo,
          device: deviceInfo,
          deviceImei: localStorage.getItem('venom_device_imei') || 'TEST-CONSOLE'
        })
      });

      if (!syncResponse.ok) {
        const errJson = await syncResponse.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save subscription metadata inside Firestore.');
      }
      addDiagnosticLog('Subscription metadata synchronized with Cloud database.');

      // 7. Dispatch Targeted Self-Test
      addDiagnosticLog('Triggering targeted diagnostic loop payload dispatches...');
      const testResponse = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'TEST DISPATCH SYSTEM',
          message: body || 'Cryptographic self-test signal broadcast loop succeeded.',
          icon,
          badge,
          image,
          url,
          targetEndpoint: subscription.endpoint // Strictly direct to this endpoint only
        })
      });

      const testData = await testResponse.json();
      if (!testResponse.ok || !testData.success) {
        throw new Error(testData.error || 'Targeted test dispatch rejected by server.');
      }

      addDiagnosticLog(`[SUCCESS] Direct device delivery loop complete. Execution: ${testData.executionTimeMs}ms.`);
      
      if (isAiStudioPreview()) {
        addDiagnosticLog('[NOTICE] Running in AI Studio Sandbox Preview. Background dispatches may be intercepted by proxy authentication layers. Real web-push dispatches will execute once deployed on your secure standalone production URL.');
      }
    } catch (err: any) {
      addDiagnosticLog(`[ERROR] Self-test aborted: ${err.message}`);
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  const resetStatus = () => {
    setStatus('idle');
    setStats(null);
    setErrorMsg('');
  };

  return (
    <div className="bg-zinc-950 border border-emerald-500/10 rounded-xl p-4 shadow-xl relative overflow-hidden font-mono" id="admin-push-broadcaster">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.01] rounded-full blur-3xl pointer-events-none" />
      
      {/* Header and Title */}
      <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-900">
        <div className="p-1.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-400">
          <Radio className={`w-4 h-4 ${status === 'sending' ? 'animate-pulse text-rose-500' : ''}`} />
        </div>
        <div className="flex-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block leading-none">
            Tactical Push Broadcaster
          </span>
          <span className="text-[8px] text-zinc-500 uppercase font-sans mt-1 block">
            Emergency broadcasts and targeted diagnostic diagnostics for standard PWA clients.
          </span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-zinc-900 bg-black/20 text-[9px] font-bold uppercase tracking-wider mb-4 mt-2">
        <button
          onClick={() => setActiveTab('broadcast')}
          className={`px-3.5 py-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'broadcast' 
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/40' 
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Send className="w-3 h-3" />
          <span>Broadcast Dispatch</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3.5 py-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'history' 
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/40' 
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <History className="w-3 h-3" />
          <span>Transmission History</span>
        </button>
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`px-3.5 py-2 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'diagnostics' 
              ? 'border-emerald-500 text-emerald-400 bg-zinc-900/40' 
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Terminal className="w-3 h-3" />
          <span>Diagnostics Console</span>
        </button>
      </div>

      {/* WARNING banner for AI Studio preview mode */}
      {isAiStudioPreview() && (
        <div className="mb-4 bg-amber-950/10 border border-amber-500/20 rounded p-2.5 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block">
              AI Studio Preview Mode Detected
            </span>
            <p className="text-[8px] leading-relaxed text-zinc-500 font-sans">
              Push Notifications cannot work inside AI Studio Preview. Proxy cookie handshakes and sandbox iframe restrictions block active push servers. Please test this flow from your deployed standalone HTTPS website.
            </p>
          </div>
        </div>
      )}

      {/* TAB CONTENT: BROADCAST FORM */}
      {activeTab === 'broadcast' && (
        <div className="space-y-4">
          {status === 'sending' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center bg-zinc-950/50 border border-zinc-900 rounded">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Broadcasting Dispatch...</h4>
                <p className="text-[10px] text-zinc-500 max-w-xs font-sans leading-relaxed">
                  Negotiating cryptographic dispatches across Cloud push subscription endpoints...
                </p>
              </div>
            </div>
          )}

          {status === 'success' && stats && (
            <div className="py-4 space-y-4 bg-zinc-950/50 border border-zinc-900 rounded p-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Transmission Dispatched</h4>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[9px] bg-black/40 border border-zinc-900 p-2.5 rounded font-mono">
                <div className="space-y-0.5">
                  <span className="text-zinc-500 uppercase">Delivered</span>
                  <span className="text-emerald-400 block font-bold text-xs">{stats.sentCount} devices</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-zinc-500 uppercase">Expired/Pruned</span>
                  <span className="text-rose-400 block font-bold text-xs">{stats.failedCount} obsolete</span>
                </div>
                <div className="space-y-0.5 col-span-2 border-t border-zinc-900 pt-1.5 mt-1">
                  <span className="text-zinc-500 uppercase">Execution Time</span>
                  <span className="text-zinc-300 block font-semibold">{stats.executionTimeMs} ms</span>
                </div>
              </div>

              <p className="text-[9px] text-zinc-500 font-sans leading-relaxed">
                {stats.message}
              </p>

              <button
                onClick={resetStatus}
                className="w-full py-1.5 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
              >
                New Broadcast Protocol
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4 space-y-4 bg-zinc-950/50 border border-zinc-900 rounded p-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Broadcast Aborted</h4>
              </div>

              <p className="text-[10px] text-zinc-400 leading-relaxed font-sans bg-rose-950/10 border border-rose-500/10 p-3 rounded">
                {errorMsg}
              </p>

              <button
                onClick={resetStatus}
                className="w-full py-1.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/25 text-rose-400 text-[9px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
              >
                Retry Dispatch Setup
              </button>
            </div>
          )}

          {status === 'idle' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Form Input fields (7 columns) */}
              <form onSubmit={handleBroadcast} className="space-y-3 lg:col-span-7">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">Dispatch Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. NETWORK UPDATE: Sector 4 Breach"
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-850 rounded focus:outline-none focus:border-emerald-500/30 text-zinc-200"
                  />
                </div>

                {/* Message Body */}
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block">Message Body</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="e.g. A new anonymous cryptographic dispatch has been declassified..."
                    required
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-850 rounded focus:outline-none focus:border-emerald-500/30 text-zinc-200 resize-none font-sans"
                  />
                </div>

                {/* Optional Customizations Toggle */}
                <div className="p-2.5 bg-black/40 border border-zinc-900 rounded space-y-3">
                  <div className="flex items-center gap-1.5 text-[8px] font-black uppercase text-zinc-500 tracking-wider">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Payload Customizations</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Icon */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-semibold text-zinc-600 uppercase tracking-wider block">Icon URL</label>
                      <input
                        type="text"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="w-full px-2 py-1 text-[10px] bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/20 text-zinc-400"
                      />
                    </div>

                    {/* Badge */}
                    <div className="space-y-1">
                      <label className="text-[8px] font-semibold text-zinc-600 uppercase tracking-wider block">Badge URL</label>
                      <input
                        type="text"
                        value={badge}
                        onChange={(e) => setBadge(e.target.value)}
                        className="w-full px-2 py-1 text-[10px] bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/20 text-zinc-400"
                      />
                    </div>

                    {/* Image URL */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[8px] font-semibold text-zinc-600 uppercase tracking-wider block">Big Attachment Image URL (Optional)</label>
                      <input
                        type="text"
                        value={image}
                        onChange={(e) => setImage(e.target.value)}
                        placeholder="https://example.com/attachments/media.jpg"
                        className="w-full px-2 py-1 text-[10px] bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/20 text-zinc-400"
                      />
                    </div>

                    {/* Action Route */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[8px] font-semibold text-zinc-600 uppercase tracking-wider block">Redirection Target Route</label>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full px-2 py-1 text-[10px] bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/20 text-zinc-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSelfTest}
                    className="flex-1 py-1.5 border border-zinc-850 hover:border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 text-[9px] font-black uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Test Current Browser</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!title.trim() || !body.trim()}
                    className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1 shadow-lg shadow-emerald-950/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Transmit Broadcast</span>
                  </button>
                </div>
              </form>

              {/* Dynamic Notification Mockup Preview (5 columns) */}
              <div className="lg:col-span-5 flex flex-col justify-between border border-zinc-900 bg-black/40 rounded-lg p-3 relative select-none">
                <div className="flex items-center justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-3">
                  <span>Interactive Preview Mock</span>
                  <button 
                    type="button" 
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{showPreview ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                {showPreview ? (
                  <div className="space-y-4">
                    {/* Simulated Smartphone Lock Screen Alert */}
                    <div className="border border-zinc-800 bg-zinc-950/90 rounded-xl p-3 shadow-2xl relative max-w-[260px] mx-auto overflow-hidden">
                      <div className="h-0.5 w-16 bg-zinc-800 rounded-full mx-auto mb-2" />
                      
                      <div className="flex gap-2.5 items-start">
                        <img 
                          src={icon || 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png'} 
                          alt="Notification Icon" 
                          className="w-7 h-7 rounded bg-zinc-900 border border-zinc-850 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png';
                          }}
                        />
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-zinc-100 truncate pr-2 uppercase">
                              {title.trim() ? title : 'VENOM SECURE SIGNAL'}
                            </span>
                            <span className="text-[7px] text-zinc-500 font-sans tracking-tight">now</span>
                          </div>
                          <p className="text-[8px] text-zinc-400 font-sans leading-normal break-words">
                            {body.trim() ? body : 'Anonymous decentralized transmission dispatches pending...'}
                          </p>
                        </div>
                      </div>

                      {image.trim() && (
                        <div className="mt-2.5 rounded border border-zinc-900 overflow-hidden bg-black max-h-[80px] flex items-center justify-center">
                          <img 
                            src={image} 
                            alt="Notification Large Media" 
                            className="w-full object-cover max-h-[80px]"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      <div className="mt-2 pt-1.5 border-t border-zinc-900 flex justify-between items-center text-[6px] text-zinc-500 uppercase tracking-widest font-bold">
                        <span>slide to decrypt / open</span>
                        <ChevronRight className="w-2.5 h-2.5 text-zinc-500" />
                      </div>
                    </div>

                    <p className="text-[7px] text-zinc-600 leading-normal text-center font-sans">
                      This mockup renders layout guidelines for chrome-compatible desktop cards and typical mobile lock-screens.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-zinc-600 space-y-1">
                    <Eye className="w-5 h-5 text-zinc-700" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Mock Screen Disabled</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: HISTORY LIST */}
      {activeTab === 'history' && (
        <div className="space-y-3 font-mono">
          <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase border-b border-zinc-900 pb-1.5">
            <span>Past Broadcast dispatches</span>
            <button 
              onClick={loadHistory} 
              disabled={isLoadingHistory}
              className="text-emerald-400 hover:text-emerald-300 disabled:text-zinc-600 flex items-center gap-1 cursor-pointer font-bold"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 flex items-center justify-center text-zinc-500 gap-2">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-[9px] uppercase tracking-wider">Accessing ledger records...</span>
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="py-10 text-center text-zinc-600 text-[9px] uppercase tracking-wider">
              No historical broadcast transmissions found in database records.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {historyLogs.map((log) => (
                <div key={log.id} className="border border-zinc-900 bg-black/40 rounded p-2.5 space-y-2 hover:border-zinc-800 transition-colors">
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-950 pb-1">
                    <span className="text-[9px] font-black text-emerald-400 uppercase truncate">
                      {log.title}
                    </span>
                    <span className="text-[8px] text-zinc-500 font-sans shrink-0">
                      {log.sentAt ? new Date(log.sentAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  <p className="text-[9px] text-zinc-400 font-sans break-words leading-relaxed">
                    {log.message}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[7.5px] uppercase font-bold text-zinc-500 pt-1 border-t border-zinc-950">
                    <div>
                      DELIVERED: <span className="text-emerald-500 font-black">{log.sentCount ?? 0} devices</span>
                    </div>
                    <div>
                      PRUNED: <span className="text-rose-500 font-black">{log.failedCount ?? 0}</span>
                    </div>
                    <div>
                      EXECUTION: <span className="text-zinc-300">{log.executionTimeMs ?? 0} ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: DIAGNOSTICS & TEST MODE LOGGER */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-3 font-mono">
          <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase border-b border-zinc-900 pb-1.5">
            <span>Diagnostics Command Console</span>
            <button 
              onClick={handleSelfTest} 
              disabled={isTesting}
              className="text-emerald-400 hover:text-emerald-300 disabled:text-zinc-600 flex items-center gap-1 cursor-pointer font-bold"
            >
              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Executing...' : 'Re-Run diagnostics'}</span>
            </button>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded p-3 h-[240px] overflow-y-auto space-y-1.5 text-[9px] text-zinc-400 leading-normal scrollbar-thin">
            {diagnosticLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 space-y-1.5 uppercase tracking-wider">
                <Terminal className="w-6 h-6 text-zinc-800" />
                <span>Diagnostics terminal offline</span>
                <button
                  onClick={handleSelfTest}
                  className="px-2 py-0.5 bg-emerald-950/20 border border-emerald-500/10 rounded text-emerald-400 text-[8px] font-black cursor-pointer hover:bg-emerald-950/40"
                >
                  Connect & Test Client
                </button>
              </div>
            ) : (
              diagnosticLogs.map((log, index) => {
                let colorClass = 'text-zinc-400';
                if (log.includes('[ERROR]')) colorClass = 'text-rose-500 font-bold';
                if (log.includes('[SUCCESS]')) colorClass = 'text-emerald-400 font-black';
                if (log.includes('[WARNING]')) colorClass = 'text-amber-500 font-bold';
                
                return (
                  <div key={index} className={`whitespace-pre-wrap leading-relaxed ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>

          <div className="text-[7.5px] uppercase font-bold text-zinc-600 leading-normal">
            * Self-test generates a local subscription token and registers it immediately to transmit a targeted web-push bypass payload to verification clients.
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminPushBroadcaster;
